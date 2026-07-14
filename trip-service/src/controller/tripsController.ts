import { Request, Response, NextFunction } from "express";

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
      "INSERT INTO trips (rider_id , origin_lat , origin_lng , dest_lat , dest_lng) VALUES ($1, $2 , $3 , $4 , $5) RETURNING id , status",
      [rider_id, origin_lat, origin_lng, dest_lat, dest_lng],
    );

    //Emit the event

    res.status(201).json({
      message: "Trip created",
      tripId: result.rows[0].id,
      status: result.rows[0].status,
    });
  } catch (err) {
    next(err);
  }
};
