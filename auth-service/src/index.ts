import express from 'express';

const SERVICE_NAME = 'auth-service';
const PORT = process.env.PORT || 3001;

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
});
