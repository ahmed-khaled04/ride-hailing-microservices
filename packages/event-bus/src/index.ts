import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");
const STREAM_KEY = "stream:trip-events";

export type TripEvent = {
  eventId: string;
  type: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

export async function publishEvents(
  type: string,
  data: Record<string, unknown>,
) {
  const envelope: TripEvent = {
    eventId: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    data,
  };
  await redis.xadd(STREAM_KEY, "*", "payload", JSON.stringify(envelope));
  return envelope;
}

export async function consumeEvent(
  group: string,
  consumerName: string,
  handler: (event: TripEvent) => Promise<void>,
) {
  try {
    await redis.xgroup("CREATE", STREAM_KEY, group, "$", "MKSTREAM");
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) throw err;
  }

  while (true) {
    const results = await redis.xreadgroup(
      "GROUP",
      group,
      consumerName,
      "COUNT",
      10,
      "BLOCK",
      5000,
      "STREAMS",
      STREAM_KEY,
      ">",
    );
    if (!results) continue;

    for (const [, messages] of results as [string, [string, string[]][]][]) {
      for (const [id, fields] of messages) {
        const envelope: TripEvent = JSON.parse(fields[1]);
        try {
          await handler(envelope);
          await redis.xack(STREAM_KEY, group, id);
        } catch (err) {
          console.error(`Failed processing ${id}:`, err);
        }
      }
    }
  }
}
