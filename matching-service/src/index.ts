import os from "os";
import express from "express";
import { consumeEvent } from "event-bus";

import { handleTripRequested } from "./matching";

const SERVICE_NAME = "matching-service";
const PORT = process.env.PORT || 3003;

consumeEvent("matching-service", `matching-${os.hostname()}`, async (event) => {
  if (event.type !== "trip.requested") return;
  await handleTripRequested(
    event.data as {
      tripId: string;
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
    },
  );
});

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: SERVICE_NAME });
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
