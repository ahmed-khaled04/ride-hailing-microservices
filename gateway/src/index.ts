import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cors from "cors";
import { publish, subscribe } from "event-bus";

import { authProxy } from "./proxy/authProxy";
import { tripsProxy } from "./proxy/tripsProxy";
import { offersProxy } from "./proxy/offersProxy";
import { driversProxy } from "./proxy/driversProxy";

import { verifyToken } from "./middleware/verifyJwt";
import { errorHandler } from "./middleware/errorHandler";

const SERVICE_NAME = "gateway";
const PORT = process.env.PORT || 3000;

// Matches any localhost port so the Vite dev server works regardless of which
// port it lands on (5173 falls back to the next free one when already in use).
const CORS_ORIGIN = /^http:\/\/localhost:\d+$/;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

app.use(cors({ origin: CORS_ORIGIN }));

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("No Token Found"));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decoded === "string") {
      return next(new Error("Invalid Token"));
    }
    socket.data.userId = decoded.sub;
    socket.data.role = decoded.role;
    next();
  } catch (err) {
    next(new Error("Invalid Token"));
  }
});

io.on("connection", (socket) => {
  socket.join(socket.data.userId);
  socket.on("driver:location", (data) => {
    if (socket.data.role !== "driver") return;
    publish("driver:location", {
      driverId: socket.data.userId,
      lat: data.lat,
      lng: data.lng,
      heading: data.heading,
    });
  });
});

subscribe("rider:*:location", (channel, data) => {
  const riderId = channel.split(":")[1];
  io.to(riderId).emit("location:update", data);
});

subscribe("user:*:notify", (channel, payload) => {
  const userId = channel.split(":")[1];
  io.to(userId).emit(payload.type, payload.data);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: SERVICE_NAME });
});

app.use("/auth", authProxy);
app.use("/trips", verifyToken, tripsProxy);
app.use("/offers", verifyToken, offersProxy);
app.use("/drivers", verifyToken, driversProxy);

app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
