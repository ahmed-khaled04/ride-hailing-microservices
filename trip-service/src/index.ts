import express from "express";

import tripsRouter from "./routes/trips";
import { errorHandler } from "./middleware/errorHandler";
import { startTripEventsConsumer } from "./events/consumer";

const SERVICE_NAME = "trip-service";
const PORT = process.env.PORT || 3002;

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: SERVICE_NAME });
});

app.use("/trips", tripsRouter);

app.use(errorHandler);

startTripEventsConsumer();

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
