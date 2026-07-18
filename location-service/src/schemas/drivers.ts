import { z } from "zod";

export const driverStatusSchema = z.object({
  status: z.enum(["available", "offline"]),
});
