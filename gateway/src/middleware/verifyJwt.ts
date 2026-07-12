import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import { HttpError } from "../schemas/errors";

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.get("Authorization")?.split(" ")[1];
    if (!token) {
      return next(new HttpError("No Token Found", 401));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof decoded === "string") {
      return next(new HttpError("Invlaid Token", 401));
    }
    req.user = decoded;
    next();
  } catch (err) {
    next(new HttpError("Invalid or expired token", 401));
  }
};
