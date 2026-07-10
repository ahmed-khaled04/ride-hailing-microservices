import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../db";
import { HttpError } from "../errors";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password, name, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      "INSERT INTO users (email , password, name, role) VALUES ($1 , $2 , $3 , $4) RETURNING id, email ,role",
      [email, hashedPassword, name, role],
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" },
    );
    res.status(201).json({ message: "User registered", token });
  } catch (err: any) {
    if (err.code === "23505") {
      return next(new HttpError("Email already exists", 409));
    }
    next(err);
  }
};
