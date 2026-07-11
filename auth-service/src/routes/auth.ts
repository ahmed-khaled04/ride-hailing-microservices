import express from "express";

import { signupHandler, loginHandler } from "../controller/auth";
import { validate } from "../middleware/validate";
import { signupSchema, loginSchema } from "../schemas/auth";

const router = express.Router();

router.post("/signup", validate(signupSchema), signupHandler);

router.post("/login", validate(loginSchema), loginHandler);

export default router;
