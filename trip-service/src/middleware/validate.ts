import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { HttpError } from "../errors";

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new HttpError("Invalid data", 422));
    }
    req.body = parsed.data;
    next();
  };
};
