import { redis } from "./redis";

const DRIVERS_GEO_KEY = "drivers:geo";

export function driverPositionKey(driverId: string): string {
  return `driver:${driverId}:position`;
}

export function driverStatusKey(driverId: string): string {
  return `driver:${driverId}:status`;
}

export async function removeDriverFromGeo(driverId: string) {
  await redis.zrem(DRIVERS_GEO_KEY, driverId);
}

export async function updateDriverPosition(
  driverId: string,
  lat: number,
  lng: number,
  heading: number,
) {
  await redis.geoadd(DRIVERS_GEO_KEY, lng, lat, driverId);
  await redis.hset(driverPositionKey(driverId), {
    lat,
    lng,
    heading,
    updatedAt: new Date().toISOString(),
  });
}
