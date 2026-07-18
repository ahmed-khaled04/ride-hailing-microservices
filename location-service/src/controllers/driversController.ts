import { Request, Response, NextFunction } from "express";

import { redis } from "../redis";
import { driverStatusKey, removeDriverFromGeo } from "../geo";
import { HttpError } from "../errors";

export const setDriverStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const driverId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];
    const { status } = req.body;

    if (!driverId || typeof driverId !== "string") {
      return next(new HttpError("Missing user identity", 401));
    }

    if (userRole !== "driver") {
      return next(new HttpError("Only drivers can set status", 403));
    }

    if (status === "available") {
      await redis.set(driverStatusKey(driverId), "available");
      return res.status(200).json({ message: "Status updated", status });
    }

    const claimed = await redis.claimDriver(
      driverStatusKey(driverId),
      "available",
      "offline",
    );
    if (claimed !== 1) {
      return next(new HttpError("Cannot go offline mid-trip", 409));
    }

    await removeDriverFromGeo(driverId);
    res.status(200).json({ message: "Status updated", status });
  } catch (err) {
    next(err);
  }
};
