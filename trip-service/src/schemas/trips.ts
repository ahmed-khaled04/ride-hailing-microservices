import { z } from "zod";

export const createTripSchema = z.object({
  origin_lat: z.number().min(-90).max(90),
  origin_lng: z.number().min(-180).max(180),
  dest_lat: z.number().min(-90).max(90),
  dest_lng: z.number().min(-180).max(180),
});
