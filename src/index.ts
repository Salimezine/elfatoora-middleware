import "dotenv/config";

import type { NextFunction, Request, Response } from "express";
import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { verifyToken } from "./business-logic/auth/token.js";
import { initializeCronJobs, stopCronJobs } from "./cron/index.js";
import type { TkrCustomers } from "./db/schema.js";
import { router } from "./routes/index.js";
import { validateRequiredEnvVars } from "./utils/env.utils.js";
import { normalizeValidationErrors } from "./utils/zod.utils.js";

validateRequiredEnvVars();

const app: Express = express();
let cronJobs: ReturnType<typeof initializeCronJobs> | null = null;

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
    service: "tkr-efatoora-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? "development",
  });
});

// Add global auth using token and inject the customer into the context
declare global {
  namespace Express {
    interface Request {
      context: { customer: TkrCustomers };
    }
  }
}
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health") return next();

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ error: "UNAUTHORIZED", message: "Missing token" });
  }

  // Verify token and extract customer info
  try {
    const { customer, error } = await verifyToken(token);
    if (error || !customer) {
      return res.status(401).json({ error, message: "Invalid token" });
    }
    // Inject customer into request context
    req.context = { customer };
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
  }
});

// CORS configuration
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// API routes
app.use(`/v${API_VERSION}/`, router);

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: normalizeValidationErrors(err.issues),
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ error: "INTERNAL_ERROR", message });
});

// Server bootstrap
const PORT = Number(process.env.PORT ?? 3000);

const server = app.listen(PORT, () => {
  // Intentionally minimal (no logger)
  console.info(`tkr-efatoora-api listening on port ${PORT}`);
});

// Initialize cron jobs
cronJobs = initializeCronJobs();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.info("SIGTERM received, shutting down gracefully");
  if (cronJobs) {
    stopCronJobs(cronJobs);
  }
  server.close(() => {
    console.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.info("SIGINT received, shutting down gracefully");
  if (cronJobs) {
    stopCronJobs(cronJobs);
  }
  server.close(() => {
    console.info("Server closed");
    process.exit(0);
  });
});

// For testing purposes
export { app };

// Export server for testing purposes
export { server };

// Export cronJobs for testing purposes
export { cronJobs };

// Export API_VERSION for testing purposes
export { API_VERSION };
