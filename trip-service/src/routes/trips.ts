import express from "express";

import {
  createTrip,
  fetchTrip,
  cancelTrip,
} from "../controller/tripsController";
import { validate } from "../middleware/validate";
import {
  createTripSchema,
  fetchTripSchema,
  cancelTripParamsSchema,
  CancelTripBodySchema,
} from "../schemas/trips";

const router = express.Router();

router.post("/", validate(createTripSchema), createTrip);

// Get Trip
router.get("/:id", validate(fetchTripSchema, "params"), fetchTrip);

// Cancel Trip
router.post(
  "/:id/cancel",
  validate(cancelTripParamsSchema, "params"),
  validate(CancelTripBodySchema),
  cancelTrip,
);

export default router;
