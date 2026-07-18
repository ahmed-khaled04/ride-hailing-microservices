import { redis } from "./redis";

const activeTripKey = (driverId: string) => `driver:${driverId}:activeTrip`;

export async function setActiveTrip(
  driverId: string,
  tripId: string,
  riderId: string,
) {
  await redis.set(
    activeTripKey(driverId),
    JSON.stringify({ tripId, riderId }),
    "EX",
    7200,
  );
}

export async function getActiveTrip(driverId: string) {
  const raw = await redis.get(activeTripKey(driverId));
  return raw ? JSON.parse(raw) : null;
}

export async function clearActiveTrip(driverId: string) {
  await redis.del(activeTripKey(driverId));
}
