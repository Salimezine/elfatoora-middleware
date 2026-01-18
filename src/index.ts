import "dotenv/config";

import type { NextFunction, Request, Response } from "express";
import express from "express";
import { randomUUID } from "node:crypto";
import { verifyToken } from "./business-logic/auth/token.js";
import type { TkrCustomers } from "./db/schema.js";
import { router } from "./routes/index.js";
import { validateRequiredEnvVars } from "./utils/env.utils.js";

validateRequiredEnvVars();

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
    // TODO: Implement token verification logic (e.g., JWT verification)
    const { customer, error } = await verifyToken(token);
    if (error || !customer) {
      return res.status(401).json({ error, message: "Invalid token" });
    }
    req.context = { customer };
    // Extend Express Request type to include customer

    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
  }
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
