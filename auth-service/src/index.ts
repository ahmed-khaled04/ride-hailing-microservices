import express from "express";

import authRouter from "./routes/auth";

const SERVICE_NAME = "auth-service";
const PORT = process.env.PORT || 3001;

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: SERVICE_NAME });
});

app.use("/auth", authRouter);

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
