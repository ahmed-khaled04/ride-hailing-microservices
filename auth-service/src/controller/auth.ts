import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../db";
import { HttpError } from "../errors";

export const signupHandler = async (
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

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return next(new HttpError("Email or password is incorrect", 401));
    }
    const user = result.rows[0];
    const isPasswordEqual = await bcrypt.compare(password, user.password);
    if (!isPasswordEqual) {
      return next(new HttpError("Email or password is incorrect", 401));
    }
    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" },
    );
    res.status(200).json({ message: "Success", token });
  } catch (err) {
    next(err);
  }
};
