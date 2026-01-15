import type {
  Router as ExpressRouter,
  NextFunction,
  Request,
  Response,
} from "express";
import { Router } from "express";
import type { ControlledTransaction } from "kysely";
import z from "zod";
import { saveIncomingDocuments } from "../business-logic/document/save-incoming-document.js";
import {
  createSignatureTransaction,
  type CreateSignatureTransactionInput,
} from "../business-logic/ngsign/create-transaction.js";
import { mapInvoiceToTeifXml } from "../business-logic/teif/map-json-to-teif.js";
import { buildTeifXml } from "../business-logic/teif/teif-xml-builder.js";
import { db } from "../db/client.js";
import type { DB } from "../db/schema.js";
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
 * POST /v1/documents
 * Create and sign new documents
 * ---------------------------------------------------------------------
 */
documentsRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    let trx: ControlledTransaction<DB, []> | null = null;
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
      trx = await db.startTransaction().execute();
      const savedDocs = await saveIncomingDocuments(
        trx,
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

      // Save UUID mapping to DB
      const cbData = savedDocs.map((item) => ({
        uuid: signResponse.uuid,
        document_id: item.id,
        customer_id: req.context.customer.id as unknown as string,
        success_callback_url:
          payload.successUrl || req.context.customer.default_success_url || "",
        failure_callback_url:
          payload.failureUrl || req.context.customer.default_failure_url || "",
        status: "PENDING" as const,
        created_at: new Date(),
        updated_at: new Date(),
      }));
      await trx
        .insertInto("tbl_tkr_signature_callback")
        .values(cbData)
        .execute();

      await trx.commit().execute();

      res.status(202).json({
        message: "Invoice accepted for signing, please redirect user to sign.",
        signatureUUID: signResponse.uuid,
        signatureUrl: signResponse.url,
      });
    } catch (err) {
      if (trx) await trx.rollback().execute();
      next(err);
    }
  }
);

/**
 * ---------------------------------------------------------------------
 * GET /v1/documents/callback/:status?hash=
 * Handle NGSign callback with status and hash
 * ---------------------------------------------------------------------
 */
documentsRouter.get(
  "/callback/:status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hash } = req.query;

      const status = z
        .enum(["success", "failure"])
        .safeParse(req.params.status);
      if (!status.success) {
        res.status(400).json({
          message: "Status must be either 'success' or 'failure'",
        });
        return;
      }

      if (!hash || typeof hash !== "string") {
        res.status(400).json({
          message: "Missing or invalid hash parameter",
        });
        return;
      }

      // Decode hash from base64
      const decoded = Buffer.from(hash, "base64").toString("utf-8");
      const [uuid, documentId, customerId] = decoded.split(":");

      if (!uuid || !documentId || !customerId) {
        res.status(400).json({
          message: "Invalid hash format",
        });
        return;
      }

      // Check existing callback entry
      // Update the correct entry based on UUID and document ID
      // Redirect the correct callback url
    } catch (err) {
      next(err);
    }
  }
);
