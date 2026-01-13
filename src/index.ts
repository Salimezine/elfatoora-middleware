import "dotenv/config";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { randomUUID } from "node:crypto";
import { router } from "./routes/index.js";

const app = express();

const API_VERSION = "1";

// Correlation / request id
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"]?.toString() ?? randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.raw({ type: ["application/xml", "text/xml"], limit: "5mb" }));

// Health & meta
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "tkr-efatoura-api",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use(`/v${API_VERSION}/`, router);

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ error: "INTERNAL_ERROR", message });
});

// Server bootstrap
const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  // Intentionally minimal (no logger)
  console.info(`tkr-efatoura-api listening on port ${PORT}`);
});
