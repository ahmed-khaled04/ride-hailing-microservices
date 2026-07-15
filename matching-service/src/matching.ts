import { redis } from "./redis";
import { createOffer, driverStatusKey, findNearbyDrivers } from "./geo";
import { publishEvents } from "event-bus";

export async function handleTripRequested(data: {
  tripId: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}) {
  const candidates = await findNearbyDrivers(data.originLat, data.originLng, 5);

  for (const driverId of candidates) {
    const claimed = await redis.claimDriver(
      driverStatusKey(driverId),
      "available",
      "offered",
    );
    if (claimed === 1) {
      await createOffer(driverId, data.tripId, 20);
      await publishEvents("trip.offer.created", {
        tripId: data.tripId,
        driverId: driverId,
        expiresAt: new Date(Date.now() + 20_000).toISOString(),
      });
      return 1;
    }
  }
}
