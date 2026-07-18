import { consumeEvent, publish } from "event-bus";
import os from "os";

export function startNotificationConsumer() {
  consumeEvent(
    "notification-service",
    `notification-${os.hostname()}`,
    async (event) => {
      switch (event.type) {
        case "trip.requested":
          await notify(event.data.riderId as string, "trip:update", event.data);
          break;
        case "trip.offer.created":
          await notify(event.data.driverId as string, "offer:new", event.data);
          break;
        case "trip.offer.rejected":
          await notify(
            event.data.driverId as string,
            "trip:update",
            event.data,
          );
          break;
        case "trip.matched":
        case "trip.state_changed":
        case "trip.cancelled":
          await notify(event.data.riderId as string, "trip:update", event.data);
          await notify(
            event.data.driverId as string,
            "trip:update",
            event.data,
          ); // skip if null
          break;
        case "trip.no_drivers_available":
          await notify(event.data.riderId as string, "trip:update", event.data);
          break;
        default:
          break;
      }
    },
  );
}

async function notify(
  userId: string | null | undefined,
  type: string,
  data: Record<string, unknown>,
) {
  if (!userId) return;
  await publish(`user:${userId}:notify`, { type, data });
}
