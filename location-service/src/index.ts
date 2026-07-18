import express from "express";
import { subscribe, publish } from "event-bus";

import { updateDriverPosition } from "./geo";
import driversRouter from "./routes/drivers";
import { errorHandler } from "./middleware/errorHandler";
import { startTripEventsConsumer } from "./events/consumer";
import { getActiveTrip } from "./trip";

const SERVICE_NAME = "location-service";
const PORT = process.env.PORT || 3004;

const app = express();

app.use(express.json());

subscribe("driver:location", async (channel, data) => {
  try {
    const { driverId, lat, lng, heading } = data;
    await updateDriverPosition(driverId, lat, lng, heading);
    const trip = await getActiveTrip(driverId);
    if (trip !== null) {
      const riderId = trip.riderId;
      publish(`rider:${riderId}:location`, {
        driverId,
        lat,
        lng,
        heading,
        tripId: trip.tripId,
      });
    }
  } catch (err) {
    console.error("Failed to update driver position:", err);
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: SERVICE_NAME });
});

app.use("/drivers", driversRouter);

app.use(errorHandler);

startTripEventsConsumer();

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
