import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { HttpError } from "../errors";

export const validate = (
  schema: ZodType,
  source: "body" | "params" = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(new HttpError("Invalid data", 422));
    }
    req[source] = parsed.data;
    next();
  };
};
