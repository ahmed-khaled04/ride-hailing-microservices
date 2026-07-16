import express from "express";

import { acceptOffer, rejectOffer } from "../controllers/offeresController";
import { validate } from "../middleware/validate";
import { offerParamsSchema } from "../schemas/offers";

const router = express.Router();

router.post(
  "/:tripId/accept",
  validate(offerParamsSchema, "params"),
  acceptOffer,
);

router.post(
  "/:tripId/reject",
  validate(offerParamsSchema, "params"),
  rejectOffer,
);

export default router;
