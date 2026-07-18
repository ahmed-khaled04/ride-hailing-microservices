import express from "express";

import { setDriverStatus } from "../controllers/driversController";
import { validate } from "../middleware/validate";
import { driverStatusSchema } from "../schemas/drivers";

const router = express.Router();

router.post("/status", validate(driverStatusSchema), setDriverStatus);

export default router;
