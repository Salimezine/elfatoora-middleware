import type { NextFunction, Request, Response } from "express";
import type { ControlledTransaction } from "kysely";
import z from "zod";
import {
  createIncomingDocumentsTransaction,
  savedDocAfterSign,
  saveIncomingDocumentArtifact,
  saveIncomingDocuments,
  setNGSignUUID,
  type SaveIncomingDocumentArtifactItem,
} from "../business-logic/document/incoming-documents.js";
import {
  createSignatureTransaction,
  type CreateSignatureTransactionInput,
} from "../business-logic/ngsign/create-transaction.js";
import type { WebhookPayload } from "../business-logic/ngsign/ngsign-api.js";
import { mapInvoiceToTeifXml } from "../business-logic/teif/map-json-to-teif.js";
import { buildTeifXml } from "../business-logic/teif/teif-xml-builder.js";
import { db, tbl } from "../db/client.js";
import type { DB } from "../db/schema.js";
import { DocumentSchema } from "../schemas/document.schema.js";
import { publicUrl } from "../utils/env.utils.js";
import { TkrAppError } from "../utils/error.utils.js";

/**
 * Request payload schema
 */
export const DocumentsApiSchema = z.object({
  data: z
    .array(z.object({ invoice: DocumentSchema, pdf: z.string().min(1) }))
    .min(1),
  successUrl: z.url().nullable(),
  failureUrl: z.url().nullable(),
});

/**
 * POST /v1/documents
 */
export async function createDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let opId: string | null = null;

  try {
    const payload = DocumentsApiSchema.parse(req.body);

    // Create a transaction
    opId = await createIncomingDocumentsTransaction(
      db,
      req.context.customer.id as unknown as string,
      payload.successUrl || req.context.customer.default_success_url || "",
      payload.failureUrl || req.context.customer.default_failure_url || "",
    );

    if (!opId) {
      throw new Error("Failed to create operation for incoming documents");
    }

    // Save incoming documents
    const savedDocs = await saveIncomingDocuments(
      db,
      payload.data.map((d) => d.invoice),
      opId,
      "API",
    );

    // Prepare invoices for signing
    const invoices: CreateSignatureTransactionInput["invoices"] = [];
    for (const item of payload.data) {
      if (item.invoice.seller.identifier !== req.context.customer.tax_id) {
        res.status(403).json({
          message: `Invoice issuer tax ID ${item.invoice.seller.identifier} does not match authenticated customer ${req.context.customer.tax_id}`,
          signatureUUID: null,
          signatureUrl: null,
        });
        return;
      }

      const teifObject = mapInvoiceToTeifXml(item.invoice);
      const teifXml = buildTeifXml(teifObject);

      const documentId = savedDocs.find(
        (d) => d.documentNumber === item.invoice.header.documentNumber,
      )?.id;
      if (!documentId) {
        throw new TkrAppError(
          500,
          `Saved document not found for invoice number ${item.invoice.header.documentNumber}`,
          "DOCUMENT_NOT_FOUND",
        );
      }
      const hash = Buffer.from(`${opId};${documentId}`).toString("base64");

      invoices.push({
        invoiceNumber: item.invoice.header.documentNumber,
        pdfContent: item.pdf,
        teifXmlContent: teifXml,
        callbackUrl: {
          successUrl: publicUrl(`/v1/documents/callback/success?hash=${hash}`),
          failureUrl: publicUrl(`/v1/documents/callback/failure?hash=${hash}`),
        },
      });
    }

    // Save TEIF artifacts
    const artifacts: SaveIncomingDocumentArtifactItem[] = [];
    for (const inv of invoices) {
      const doc = savedDocs.find((d) => d.documentNumber === inv.invoiceNumber);
      if (!doc) {
        throw new Error(
          `Saved document not found for invoice number ${inv.invoiceNumber}`,
        );
      }
      artifacts.push({
        operationId: opId!,
        documentId: doc.id,
        teifXmlContent: inv.teifXmlContent,
      });
    }
    await saveIncomingDocumentArtifact(db, artifacts);

    // Generate internal callback URLs and store callback records
    const hash = Buffer.from(opId).toString("base64");
    const signResponse = await createSignatureTransaction(
      {
        invoices,
        signerEmail: req.context.customer.ngsign_signer_email,
        // TODO check with ngsign for redirection after signing
        callbackUrl: {
          successUrl: publicUrl(`/v1/documents/callback/success?hash=${hash}`),
          failureUrl: publicUrl(`/v1/documents/callback/failure?hash=${hash}`),
        },
      },
      req.context.customer.ngsign_token,
      req.context.customer.mode,
    );
    await setNGSignUUID(db, opId, signResponse.uuid);

    res.status(202).json({
      message: "Invoice accepted for signing, please redirect user to sign.",
      signatureUUID: signResponse.uuid,
      signatureUrl: signResponse.url,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /v1/documents/callback/:status
 * if status is 'success', NGSign will post WebhookPayload to this endpoint
 */
export async function documentsCallback(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let trx: ControlledTransaction<DB, []> | null = null;
  try {
    const { hash } = req.query;

    const status = z.enum(["success", "failure"]).safeParse(req.params.status);

    if (!status.success) {
      res.status(400).json({
        error: "Status must be either 'success' or 'failure'",
      });
      return;
    }

    if (!hash || typeof hash !== "string") {
      res.status(400).json({
        error: "Missing or invalid hash parameter",
      });
      return;
    }

    // Hash is base64 encoded string of "<operationId>;<documentId>"
    const [operationId, documentId] = Buffer.from(hash, "base64")
      .toString("utf-8")
      .split(";");
    if (!operationId || !documentId) {
      const error = "Invalid hash parameter: missing operationId or documentId";
      res.status(400).json({ error });
      return;
    }

    // Get the operation to find NGSign UUID
    const operation = await db
      .selectFrom(tbl("operations"))
      .select(["id", "success_callback_url", "failure_callback_url"])
      .where("id", "=", operationId)
      .executeTakeFirst();

    if (!operation) {
      const e = `Operation not found for ID ${operationId}`;
      res.status(404).json({ error: e });
      return;
    }

    if (status.data === "failure") {
      await db.transaction().execute(async (trx) => {
        // Save operation as failed
        await trx
          .updateTable(tbl("operations"))
          .set({ status: "FAILED", updated_at: new Date() })
          .where("id", "=", operationId)
          .execute();
        await trx
          .updateTable(tbl("documents"))
          .set({ status: "SIGNING_FAILED", updated_at: new Date() })
          .where("operation_id", "=", operationId)
          .execute();
      });
      // Redirect to failure URL
      const url = operation.failure_callback_url;
      if (!url) {
        res.status(200).json({ message: "Operation marked as failed." });
        return;
      }
      res.redirect(url);
      return;
    }

    const item = req.body as WebhookPayload;

    // Loop through payload and update document artifacts
    if (!item.xmlBase64) {
      const e = `Missing xmlBase64 in webhook payload for operation ID ${operationId}`;
      res.status(400).json({ error: e });
      return;
    }
    if (!item.invoiceNumber) {
      const e = `Missing invoiceNumber in webhook payload for operation ID ${operationId}`;
      res.status(400).json({ error: e });
      return;
    }

    trx = await db.startTransaction().execute();
    await savedDocAfterSign(
      trx,
      operationId,
      item.invoiceNumber,
      item.xmlBase64,
    );
    await trx.commit().execute();

    // Redirect to success URL
    const url = operation.success_callback_url;
    if (!url) {
      res.status(200).json({ message: "Operation marked as successful." });
      return;
    }
    res.redirect(url);
  } catch (err) {
    if (trx) await trx.rollback().execute();
    next(err);
  }
}

/**
 * GET /v1/documents/status/:invoiceNumber
 */
export async function getDocumentStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { invoiceNumber } = z
      .object({ invoiceNumber: z.string().min(1) })
      .parse(req.params);

    const customerId = req.context.customer.id as unknown as string;

    // Get the document status
    const document = await db
      .selectFrom(tbl("documents"))
      .leftJoin(
        tbl("operations"),
        `${tbl("documents")}.operation_id`,
        `${tbl("operations")}.id`,
      )
      .select([
        `${tbl("documents")}.document_number`,
        `${tbl("documents")}.status`,
      ])
      .where(`${tbl("operations")}.customer_id`, "=", customerId)
      .where(`${tbl("documents")}.document_number`, "=", invoiceNumber)
      .executeTakeFirst();

    if (!document) {
      res.status(404).json({
        code: "DOCUMENT_NOT_FOUND",
        error: `Document with invoice number ${invoiceNumber} not found for the given operation.`,
      });
      return;
    }

    res.status(200).json({
      invoiceNumber: document.document_number,
      status: document.status,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /v1/documents/artifacts/:invoiceNumber
 */
export async function getDocumentArtifacts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { invoiceNumber } = z
      .object({ invoiceNumber: z.string().min(1) })
      .parse(req.params);

    const customerId = req.context.customer.id as unknown as string;

    // Get the document artifacts
    const artifacts = await db
      .selectFrom(tbl("documents_artifacts"))
      .innerJoin(
        tbl("documents"),
        `${tbl("documents_artifacts")}.document_id`,
        `${tbl("documents")}.id`,
      )
      .innerJoin(
        tbl("operations"),
        `${tbl("documents")}.operation_id`,
        `${tbl("operations")}.id`,
      )
      .select([
        `${tbl("documents")}.status`,
        `${tbl("documents_artifacts")}.teif_xml`,
        `${tbl("documents_artifacts")}.xml_hash`,
        `${tbl("documents_artifacts")}.ttn_reference`,
        `${tbl("documents_artifacts")}.qr_code_base64`,
      ])
      .where(`${tbl("operations")}.customer_id`, "=", customerId)
      .where(`${tbl("documents")}.document_number`, "=", invoiceNumber)
      .execute();

    if (artifacts.length === 0) {
      res.status(404).json({
        code: "ARTIFACTS_NOT_FOUND",
        error: `No artifacts found for document with invoice number ${invoiceNumber}.`,
      });
      return;
    }

    res.status(200).json({
      invoiceNumber,
      artifacts,
    });
  } catch (err) {
    next(err);
  }
}
