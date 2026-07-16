import { redis } from "./redis";

const DRIVERS_GEO_KEY = "drivers:geo";
const PENDING_OFFERS_KEY = "offers:pending";

export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<string[]> {
  return redis.geosearch(
    DRIVERS_GEO_KEY,
    "FROMLONLAT",
    lng,
    lat,
    "BYRADIUS",
    radiusKm,
    "km",
    "ASC",
  ) as Promise<string[]>;
}

export function driverStatusKey(driverId: string): string {
  return `driver:${driverId}:status`;
}

export function driverOfferKey(driverId: string): string {
  return `driver:${driverId}:offer`;
}

export async function createOffer(
  driverId: string,
  tripId: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(driverOfferKey(driverId), tripId, "EX", ttlSeconds);
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await redis.zadd(PENDING_OFFERS_KEY, expiresAt, `${driverId}:${tripId}`);
}

export async function clearOfferTracking(
  driverId: string,
  tripId: string,
): Promise<void> {
  await redis.zrem(PENDING_OFFERS_KEY, `${driverId}:${tripId}`);
}

export async function getExpiredOffers(): Promise<string[]> {
  return redis.zrangebyscore(PENDING_OFFERS_KEY, "-inf", Date.now());
}
