import express from "express";

import { authProxy } from "./proxy/authProxy";
import { tripsProxy } from "./proxy/tripsProxy";
import { offersProxy } from "./proxy/offersProxy";

import { verifyToken } from "./middleware/verifyJwt";
import { errorHandler } from "./middleware/errorHandler";

const SERVICE_NAME = "gateway";
const PORT = process.env.PORT || 3000;

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: SERVICE_NAME });
});

app.use("/auth", authProxy);
app.use("/trips", verifyToken, tripsProxy);
app.use("/offers", verifyToken, offersProxy);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
