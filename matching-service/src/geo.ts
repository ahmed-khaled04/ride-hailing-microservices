import { redis } from "./redis";

const DRIVERS_GEO_KEY = "drivers:geo";

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
}
