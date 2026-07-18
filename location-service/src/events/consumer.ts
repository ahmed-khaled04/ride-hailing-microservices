import os from "os";
import { consumeEvent } from "event-bus";

import { setActiveTrip, clearActiveTrip } from "../trip";

export function startTripEventsConsumer() {
  consumeEvent(
    "location-service",
    `location-${os.hostname()}`,
    async (event) => {
      switch (event.type) {
        case "trip.matched":
          await setActiveTrip(
            event.data.driverId as string,
            event.data.tripId as string,
            event.data.riderId as string,
          );
          break;
        case "trip.cancelled":
          if (event.data.driverId) {
            await clearActiveTrip(event.data.driverId as string);
          }
          break;
        default:
          break;
      }
    },
  );
}
