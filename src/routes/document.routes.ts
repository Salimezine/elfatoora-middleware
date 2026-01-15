import type {
  Router as ExpressRouter,
  NextFunction,
  Request,
  Response,
} from "express";
import { Router } from "express";
import z from "zod";
import { saveIncomingDocuments } from "../business-logic/document/save-incoming-document.js";
import {
  createSignatureTransaction,
  type CreateSignatureTransactionInput,
} from "../business-logic/ngsign/create-transaction.js";
import { mapInvoiceToTeifXml } from "../business-logic/teif/map-json-to-teif.js";
import { buildTeifXml } from "../business-logic/teif/teif-xml-builder.js";
import { db } from "../db/client.js";
import { DocumentSchema } from "../schemas/document.schema.js";

export const documentsRouter: ExpressRouter = Router();

const DocumentsApiSchema = z.object({
  data: z
    .array(
      z.object({
        invoice: DocumentSchema, // embedded document
        pdf: z.string().min(1), // base64 encoded PDF
      })
    )
    .min(1),
  successUrl: z.url().nullable(), // success URL can be null and must be a valid URL
  failureUrl: z.url().nullable(), // failure URL can be null and must be a valid URL
});

/**
 * ---------------------------------------------------------------------
 * POST /v1/invoices
 * Create a new invoice (async workflow)
 * ---------------------------------------------------------------------
 */
documentsRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Validate payload with Zod
      const payload = DocumentsApiSchema.parse(req.body);

      // 2. Process each invoice
      const invoices: CreateSignatureTransactionInput["invoices"] = [];
      for (const item of payload.data) {
        // Check if invoice editor is the authed customer
        if (item.invoice.seller.identifier !== req.context.customer.tax_id) {
          res.status(403).json({
            message: `Invoice issuer tax ID ${item.invoice.seller.identifier} does not match authenticated customer ${req.context.customer.tax_id}`,
            signatureUUID: null,
            signatureUrl: null,
          });
        }

        // Map JSON → TEIF XML
        const teifObject = mapInvoiceToTeifXml(item.invoice);
        const teifXml = buildTeifXml(teifObject);
        invoices.push({
          invoiceNumber: item.invoice.header.documentNumber,
          pdfContent: item.pdf,
          teifXmlContent: teifXml,
        });
      }

      // Persist initial invoice state (RECEIVED)
      await saveIncomingDocuments(
        db,
        payload.data.map((d) => d.invoice)
      );

      // 4. Validate TEIF against XSD - TODO

      // 5. Sign XML via NGSign
      const signResponse = await createSignatureTransaction(
        {
          invoices: invoices,
          signerEmail: req.context.customer.ngsign_signer_email,
          callbackUrl: {
            successUrl:
              payload.successUrl ||
              req.context.customer.default_success_url ||
              "",
            failureUrl:
              payload.failureUrl ||
              req.context.customer.default_failure_url ||
              "",
          },
        },
        req.context.customer.ngsign_token,
        req.context.customer.mode
      );

      res.status(202).json({
        message: "Invoice accepted for signing, please redirect user to sign.",
        signatureUUID: signResponse.uuid,
        signatureUrl: signResponse.url,
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
documentsRouter.get(
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
