import { z } from "zod";

export const offerParamsSchema = z.object({
  tripId: z.uuid(),
});
