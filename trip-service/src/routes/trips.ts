import express from "express";

import { createTrip } from "../controller/tripsController";
import { validate } from "../middleware/validate";
import { createTripSchema } from "../schemas/trips";

const router = express.Router();

router.post("/", validate(createTripSchema), createTrip);

export default router;
