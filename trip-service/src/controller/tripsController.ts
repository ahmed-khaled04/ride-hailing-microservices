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
                RETURNING id , status , driver_id
                            `,
      [userId, reason ?? null, id],
    );
    if (result.rows.length === 0) {
      return next(new HttpError("Trip Cannot be cancelled", 409));
    }
    trip = result.rows[0];

    await publishEvents("trip.cancelled", {
      tripId: trip.id,
      driverId: trip.driver_id,
      cancelledBy: userId,
      reason: reason ?? null,
    });

    res.status(200).json({ message: "Trip Cancelled", trip });
  } catch (err) {
    next(err);
  }
};

export const confirmPickup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

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

    const column =
      userRole === "driver"
        ? "driver_pickup_confirmed_at"
        : "rider_pickup_confirmed_at";

    await pool.query(
      `UPDATE trips
       SET ${column} = now()
       WHERE id = $1
         AND status = 'driver_en_route'
         AND ${column} IS NULL`,
      [id],
    );

    const flipResult = await pool.query(
      `UPDATE trips
       SET status = 'in_progress'
       WHERE id = $1
         AND status = 'driver_en_route'
         AND driver_pickup_confirmed_at IS NOT NULL
         AND rider_pickup_confirmed_at IS NOT NULL
       RETURNING status`,
      [id],
    );

    if (flipResult.rows.length > 0) {
      await publishEvents("trip.state_changed", {
        tripId: id,
        from: "driver_en_route",
        to: "in_progress",
        changedAt: new Date().toISOString(),
        riderId: trip.rider_id,
        driverId: trip.driver_id,
      });
    }

    res.status(200).json({
      message: "Pickup confirmed",
      status: flipResult.rows[0]?.status ?? trip.status,
    });
  } catch (err) {
    next(err);
  }
};

export const confirmDropoff = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

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

    const column =
      userRole === "driver"
        ? "driver_dropoff_confirmed_at"
        : "rider_dropoff_confirmed_at";

    await pool.query(
      `UPDATE trips
       SET ${column} = now()
       WHERE id = $1
         AND status = 'in_progress'
         AND ${column} IS NULL`,
      [id],
    );

    const flipResult = await pool.query(
      `UPDATE trips
       SET status = 'completed', completed_at = now()
       WHERE id = $1
         AND status = 'in_progress'
         AND driver_dropoff_confirmed_at IS NOT NULL
         AND rider_dropoff_confirmed_at IS NOT NULL
       RETURNING status`,
      [id],
    );

    if (flipResult.rows.length > 0) {
      await publishEvents("trip.state_changed", {
        tripId: id,
        from: "in_progress",
        to: "completed",
        changedAt: new Date().toISOString(),
        riderId: trip.rider_id,
        driverId: trip.driver_id,
      });
    }

    res.status(200).json({
      message: "Dropoff confirmed",
      status: flipResult.rows[0]?.status ?? trip.status,
    });
  } catch (err) {
    next(err);
  }
};
