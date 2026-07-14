import { z } from "zod";

export const createTripSchema = z.object({
  origin_lat: z.number().min(-90).max(90),
  origin_lng: z.number().min(-180).max(180),
  dest_lat: z.number().min(-90).max(90),
  dest_lng: z.number().min(-180).max(180),
});

export const fetchTripSchema = z.object({
  id: z.uuid(),
});

export const cancelTripParamsSchema = z.object({
  id: z.uuid(),
});

export const CancelTripBodySchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
