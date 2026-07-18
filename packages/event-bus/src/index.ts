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

let subscriberClient: Redis | null = null;

function getSubscriberClient(): Redis {
  if (!subscriberClient) {
    subscriberClient = new Redis(process.env.REDIS_URL || "redis://redis:6379");
  }
  return subscriberClient;
}

export async function publish(channel: string, data: Record<string, unknown>) {
  await redis.publish(channel, JSON.stringify(data));
}

export function subscribe(
  pattern: string,
  handler: (channel: string, data: any) => void,
) {
  const subscriber = getSubscriberClient();

  subscriber.psubscribe(pattern, (err) => {
    if (err) console.error(`Failed to subscribe to ${pattern}:`, err);
  });

  subscriber.on("pmessage", (subscribedPattern, channel, message) => {
    if (subscribedPattern !== pattern) return;
    try {
      handler(channel, JSON.parse(message));
    } catch (err) {
      console.error(`Failed to handle message on channel ${channel}:`, err);
    }
  });
}
