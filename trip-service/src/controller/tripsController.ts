import { Request, Response, NextFunction } from "express";
import { publishEvents } from "event-bus";

import { pool } from "../db";
import { HttpError } from "../errors";

export const createTrip = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rider_id = req.headers["x-user-id"];
    const user_role = req.headers["x-user-role"];
    const { origin_lat, origin_lng, dest_lat, dest_lng } = req.body;

    if (!rider_id || typeof rider_id !== "string") {
      return next(new HttpError("Missing user identity", 401));
    }

    if (user_role === "driver") {
      return next(new HttpError("Driver cannot order ride", 403));
    }

    const result = await pool.query(
      "INSERT INTO trips (rider_id , origin_lat , origin_lng , dest_lat , dest_lng) VALUES ($1, $2 , $3 , $4 , $5) RETURNING id , status , requested_at",
      [rider_id, origin_lat, origin_lng, dest_lat, dest_lng],
    );

    const trip = result.rows[0];

    //Emit the event
    await publishEvents("trip.requested", {
      tripId: trip.id,
      riderId: rider_id,
      originLat: origin_lat,
      originLng: origin_lng,
      destLat: dest_lat,
      destLng: dest_lng,
      requestedAt: trip.requested_at,
    });

    res.status(201).json({
      message: "Trip created",
      tripId: trip.id,
      status: trip.status,
    });
  } catch (err) {
    next(err);
  }
};

export const fetchTrip = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;
    const userId = req.headers["x-user-id"];

    if (!userId || typeof userId !== "string") {
      return next(new HttpError("Missing user identity", 401));
    }

    const result = await pool.query("SELECT * FROM trips WHERE id = $1", [id]);
    if (result.rows.length <= 0) {
      return next(new HttpError("Trip Not Found", 404));
    }
    const trip = result.rows[0];
    if (trip.rider_id !== userId && trip.driver_id !== userId) {
      return next(new HttpError("Trip Not Found", 404));
    }
    res.status(200).json({ message: "Success", trip });
  } catch (err) {
    next(err);
  }
};

export const cancelTrip = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason;

    const userId = req.headers["x-user-id"];

    if (!userId || typeof userId !== "string") {
      return next(new HttpError("Missing user identity", 401));
    }

    let result = await pool.query("SELECT * FROM trips WHERE id = $1", [id]);
    if (result.rows.length <= 0) {
      return next(new HttpError("Trip Not Found", 404));
    }
    let trip = result.rows[0];
    if (trip.rider_id !== userId && trip.driver_id !== userId) {
      return next(new HttpError("Trip Not Found", 404));
    }
    result = await pool.query(
      `
                UPDATE trips
                SET status = 'cancelled',
                    cancelled_by = $1,
                    cancellation_reason = $2,
                    cancelled_at = now()
                WHERE id = $3
                  AND status NOT IN ('in_progress', 'completed', 'cancelled')
                RETURNING id , status
                            `,
      [userId, reason ?? null, id],
    );
    if (result.rows.length === 0) {
      return next(new HttpError("Trip Cannot be cancelled", 409));
    }
    trip = result.rows[0];
    res.status(200).json({ message: "Trip Cancelled", trip });
  } catch (err) {
    next(err);
  }
};
