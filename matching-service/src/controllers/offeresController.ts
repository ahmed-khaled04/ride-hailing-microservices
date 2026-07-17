import { Request, Response, NextFunction } from "express";

import { redis } from "../redis";
import { clearOfferTracking, driverOfferKey, driverStatusKey } from "../geo";
import { HttpError } from "../errors";
import { publishEvents } from "event-bus";
import { retryMatch } from "../matching";
import { clearTripTracking, getTripData } from "../trip";

export const acceptOffer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

    if (!userId || typeof userId !== "string") {
      return next(new HttpError("Missing user identity", 401));
    }

    if (userRole !== "driver") {
      return next(new HttpError("Invalid Request", 401));
    }

    const offeredTripId = await redis.get(driverOfferKey(userId));
    if (offeredTripId !== tripId) {
      return next(new HttpError("No active offer for this trip", 404));
    }

    const claimed = await redis.claimDriver(
      driverStatusKey(userId),
      "offered",
      "matched",
    );
    if (claimed !== 1) {
      return next(new HttpError("Offer is no longer active", 409));
    }

    const tripData = await getTripData(tripId);

    await redis.del(driverOfferKey(userId));
    await clearTripTracking(tripId);
    await clearOfferTracking(userId, tripId);

    await publishEvents("trip.matched", {
      tripId,
      driverId: userId,
      riderId: tripData?.riderId,
      matchedAt: new Date().toISOString(),
    });

    res
      .status(200)
      .json({ message: "trip accepted", tripId, driverId: userId });
  } catch (err) {
    next(err);
  }
};

export const rejectOffer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

    if (!userId || typeof userId !== "string") {
      return next(new HttpError("Missing user identity", 401));
    }

    if (userRole !== "driver") {
      return next(new HttpError("Invalid Request", 401));
    }

    const offeredTripId = await redis.get(driverOfferKey(userId));
    if (offeredTripId !== tripId) {
      return next(new HttpError("No active offer for this trip", 404));
    }

    const claimed = await redis.claimDriver(
      driverStatusKey(userId),
      "offered",
      "available",
    );
    if (claimed !== 1) {
      return next(new HttpError("Offer is no longer active", 409));
    }

    await redis.del(driverOfferKey(userId));
    await clearOfferTracking(userId, tripId);

    await publishEvents("trip.offer.rejected", {
      tripId,
      driverId: userId,
      reason: "declined",
    });
    await retryMatch(tripId);
    res.status(200).json({ message: "trip rejected" });
  } catch (err) {
    next(err);
  }
};
