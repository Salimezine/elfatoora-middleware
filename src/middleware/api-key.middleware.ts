import type { NextFunction, Request, Response } from "express";
import { env } from "../utils/env.utils.js";

export function requireGlobalApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const providedApiKey = req.header("x-api-key");
  const expectedApiKey = env().GLOBAL_API_KEY;

  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid or missing API key",
    });
  }

  next();
}
