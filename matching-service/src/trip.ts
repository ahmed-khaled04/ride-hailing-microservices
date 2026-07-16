import { redis } from "./redis";

const tripDataKey = (tripId: string) => `trip:${tripId}:pending`;

const triedDriversKey = (tripId: string) => `trip:${tripId}:triedDrivers`;

export async function storeTripData(
  tripId: string,
  data: object,
  ttlSeconds: number,
) {
  await redis.set(tripDataKey(tripId), JSON.stringify(data), "EX", ttlSeconds);
}

export async function getTripData(tripId: string) {
  const raw = await redis.get(tripDataKey(tripId));
  return raw ? JSON.parse(raw) : null;
}

export async function markDriverTried(tripId: string, driverId: string) {
  await redis.sadd(triedDriversKey(tripId), driverId);
}

export async function getTriedDrivers(tripId: string): Promise<string[]> {
  return redis.smembers(triedDriversKey(tripId));
}

export async function clearTripTracking(tripId: string) {
  await redis.del(tripDataKey(tripId), triedDriversKey(tripId));
}
