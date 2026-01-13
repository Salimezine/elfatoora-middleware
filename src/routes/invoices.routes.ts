import type {
  Router as ExpressRouter,
  NextFunction,
  Request,
  Response,
} from "express";
import { Router } from "express";
import { InvoiceSchema } from "../schemas/invoice.schema.js";

export const invoicesRouter: ExpressRouter = Router();

/**
 * ---------------------------------------------------------------------
 * POST /v1/invoices
 * Create a new invoice (async workflow)
 * ---------------------------------------------------------------------
 */
invoicesRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body;

      // TODO:
      // 1. Validate payload with Zod
      const validatedPayload = InvoiceSchema.parse(payload);
      // 2. Persist initial invoice state (RECEIVED)
      // 3. Map JSON → TEIF XML
      // 4. Validate TEIF against XSD
      // 5. Sign XML via ngsign
      // 6. Submit to TTN
      // 7. Update state to PENDING

      res.status(202).json({
        message: "Invoice accepted for processing",
        invoiceId: "to-be-generated",
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * ---------------------------------------------------------------------
 * GET /v1/invoices/:id/status
 * Retrieve invoice processing status
 * ---------------------------------------------------------------------
 */
invoicesRouter.get(
  "/:id/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // TODO:
      // 1. Load invoice state from persistence
      // 2. If PENDING, optionally trigger a poll
      // 3. Return normalized status

      res.status(200).json({
        id,
        status: "PENDING",
      });
    } catch (err) {
      next(err);
    }
  }
);
