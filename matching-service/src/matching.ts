import { redis } from "./redis";
import {
  clearOfferTracking,
  createOffer,
  driverOfferKey,
  driverStatusKey,
  findNearbyDrivers,
  getExpiredOffers,
} from "./geo";
import { publishEvents } from "event-bus";

import {
  storeTripData,
  getTripData,
  markDriverTried,
  getTriedDrivers,
  clearTripTracking,
} from "./trip";

export async function handleTripRequested(data: {
  tripId: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}) {
  await storeTripData(data.tripId, data, 300);
  await matchTrip(data.tripId, data.originLat, data.originLng);
}

export async function retryMatch(tripId: string) {
  const tripData = await getTripData(tripId);
  if (!tripData) return;
  await matchTrip(tripId, tripData.originLat, tripData.originLng);
}

async function matchTrip(tripId: string, originLat: number, originLng: number) {
  const tried = await getTriedDrivers(tripId);
  const candidates = (await findNearbyDrivers(originLat, originLng, 5)).filter(
    (driverId) => !tried.includes(driverId),
  );

  for (const driverId of candidates) {
    const claimed = await redis.claimDriver(
      driverStatusKey(driverId),
      "available",
      "offered",
    );
    if (claimed === 1) {
      await markDriverTried(tripId, driverId);
      await createOffer(driverId, tripId, 20);
      await publishEvents("trip.offer.created", {
        tripId: tripId,
        driverId: driverId,
        expiresAt: new Date(Date.now() + 20_000).toISOString(),
      });
      return 1;
    }
  }
  await publishEvents("trip.no_drivers_available", { tripId });
  await clearTripTracking(tripId);
}

export async function sweepExpiredOffers() {
  const expired = await getExpiredOffers();

  for (const entry of expired) {
    const [driverId, tripId] = entry.split(":");
    const claimed = await redis.claimDriver(
      driverStatusKey(driverId),
      "offered",
      "available",
    );
    if (claimed === 1) {
      await publishEvents("trip.offer.rejected", {
        tripId,
        driverId,
        reason: "timeout",
      });
      await retryMatch(tripId);
    }
    await redis.del(driverOfferKey(driverId));
    await clearOfferTracking(driverId, tripId);
  }
}
