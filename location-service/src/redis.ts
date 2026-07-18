import Redis from "ioredis";
import fs from "fs";
import path from "path";

export const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

redis.defineCommand("claimDriver", {
  numberOfKeys: 1,
  lua: fs.readFileSync(
    path.join(__dirname, "scripts/claimDriver.lua"),
    "utf-8",
  ),
});

declare module "ioredis" {
  interface RedisCommander<Context> {
    claimDriver(
      statusKey: string,
      expectedStatus: string,
      newStatus: string,
    ): Promise<number>;
  }
}
