import { ControlledTransaction, Kysely } from "kysely";
import crypto from "node:crypto";
import { tbl } from "../../db/client.js";
import type {
  DateOnly,
  DB,
  DocumentEvent,
  DocumentStatus,
} from "../../db/schema.js";
import type { Document } from "../../schemas/document.schema.js";
import { TkrAppError } from "../../utils/error.utils.js";

export async function createIncomingDocumentsTransaction(
  db: Kysely<DB>,
  customerId: string,
  successCallbackUrl: string,
  failureCallbackUrl: string,
) {
  // Make a transaction to save all documents
  const operation = await db
    .insertInto(tbl("operations"))
    .values({
      id: crypto.randomUUID(),
      ngsign_uuid: null,
      customer_id: customerId,
      success_callback_url: successCallbackUrl,
      failure_callback_url: failureCallbackUrl,
      status: "PENDING",
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  return operation.id;
}

export async function saveIncomingDocuments(
  db: Kysely<DB>,
  input: Document[],
  operationId: string,
  source: string = "unknown",
) {
  const trx = await db.startTransaction().execute();
  try {
    // Insert document (aggregate root)
    const documents = await trx
      .insertInto(tbl("documents"))
      .values(
        input.map((doc) => ({
          id: crypto.randomUUID(),
          operation_id: operationId,
          source_system: source,

          document_number: doc.header.documentNumber,
          document_type: doc.header.type,
          issue_date: doc.header.issueDate as unknown as DateOnly,

          seller_tax_id: doc.seller.identifier,
          buyer_tax_id: doc.buyer?.identifier ?? null,

          currency: doc.totals.totalTTC.currency,
          total_ht: doc.totals.subtotalHT.amount,
          total_tva: doc.totals.totalTax.amount,
          total_ttc: doc.totals.totalTTC.amount,

          status: "RECEIVED",

          payload: doc,
          payload_hash: crypto
            .createHash("sha256")
            .update(JSON.stringify(doc))
            .digest("hex"),
          schema_version: "v1",

          created_at: new Date(),
          updated_at: new Date(),
        })),
      )
      .returning(["id", "document_number as documentNumber"])
      .execute();

    // Audit event
    const insertEvents: DocumentEvent[] = documents.map((doc) => ({
      id: crypto.randomUUID(),
      document_id: doc.id,
      event_type: "RECEIVED" as const,
      from_status: null,
      to_status: "RECEIVED" as const,
      metadata: { source },
      created_at: new Date(),
    }));
    await trx
      .insertInto(tbl("documents_events"))
      .values(insertEvents)
      .execute();

    await trx.commit().execute();
    return documents;
  } catch (error) {
    await trx.rollback().execute();
    throw error;
  }
}

export type SaveIncomingDocumentArtifactItem = {
  operationId: string;
  documentId: string;
  teifXmlContent: string;
};

export async function saveIncomingDocumentArtifact(
  db: Kysely<DB>,
  items: SaveIncomingDocumentArtifactItem[],
) {
  if (items.length === 0) return;

  const trx = await db.startTransaction().execute();
  try {
    await trx
      .insertInto(tbl("documents_artifacts"))
      .values(
        items.map((item) => ({
          document_id: item.documentId,
          teif_xml: item.teifXmlContent,
          xml_hash: crypto
            .createHash("sha256")
            .update(item.teifXmlContent)
            .digest("hex"),
          signer: "",
          certificate_sn: "",
          certificate_issuer: "",
          signature_hash: "",
          signed_at: new Date(0),
          generated_at: new Date(),
        })),
      )
      .returning(["document_id as documentId"])
      .execute();

    // Update document status to SIGNING_PENDING
    const documentIds = items.map((item) => item.documentId);
    await trx
      .updateTable(tbl("documents"))
      .set({
        status: "SIGNING_PENDING",
        updated_at: new Date(),
      })
      .where("id", "in", documentIds)
      .where("operation_id", "in", [items[0]!.operationId])
      .execute();

    await trx.commit().execute();
    return;
  } catch (error) {
    await trx.rollback().execute();
    throw error;
  }
}

export async function findExistingDocuments(
  db: Kysely<DB>,
  documentNumbers: string[],
  sellerTaxId: string,
) {
  if (documentNumbers.length === 0) return [];

  return db
    .selectFrom(tbl("documents"))
    .innerJoin(
      tbl("operations"),
      `${tbl("documents")}.operation_id`,
      `${tbl("operations")}.id`,
    )
    .select([
      `${tbl("documents")}.id`,
      `${tbl("documents")}.document_number`,
      `${tbl("documents")}.status`,
      `${tbl("operations")}.ngsign_uuid`,
    ])
    .where(`${tbl("documents")}.document_number`, "in", documentNumbers)
    .where(`${tbl("documents")}.seller_tax_id`, "=", sellerTaxId)
    .execute();
}

export async function setNGSignUUID(
  db: Kysely<DB>,
  operationId: string,
  ngsignUUID: string,
) {
  await db
    .updateTable(tbl("operations"))
    .set({
      ngsign_uuid: ngsignUUID,
      updated_at: new Date(),
    })
    .where("id", "=", operationId)
    .execute();
}

export async function updateDocumentStatus(
  db: Kysely<DB> | ControlledTransaction<DB, []>,
  documentId: string,
  status: DocumentStatus,
) {
  await db
    .updateTable(tbl("documents"))
    .set({
      status,
      updated_at: new Date(),
    })
    .where("id", "=", documentId)
    .execute();
}

export async function savedDocAfterSign(
  trx: ControlledTransaction<DB, []>,
  operationId: string,
  invoiceNumber: string,
  xmlBase64: string,
) {
  if (!xmlBase64) {
    const e = `Missing xmlBase64 in webhook payload for operation ID ${operationId}`;
    throw new TkrAppError(400, e, "MISSING_XML_BASE64");
  }
  // Find document by operation ID and invoice number
  const document = await trx
    .selectFrom(tbl("documents"))
    .select(["id", "document_number"])
    .where("operation_id", "=", operationId)
    .where("document_number", "=", invoiceNumber!)
    .executeTakeFirst();
  if (!document) {
    const e = `Document not found for operation ID ${operationId} and invoice number ${invoiceNumber}`;
    throw new TkrAppError(404, e, "DOCUMENT_NOT_FOUND");
  }
  // Update document artifact with signed TEIF XML
  await trx
    .updateTable(tbl("documents_artifacts"))
    .set({
      teif_xml: xmlBase64,
      xml_hash: crypto.createHash("sha256").update(xmlBase64).digest("hex"),
      certificate_issuer: "NGSign",
      signed_at: new Date(),
    })
    .where("document_id", "=", document.id)
    .execute();

  // Update document status to TTN_PENDING
  await trx
    .updateTable(tbl("documents"))
    .set({
      status: "TTN_PENDING",
      updated_at: new Date(),
    })
    .where("id", "=", document.id)
    .execute();

  // Save the signature event
  await trx
    .insertInto(tbl("documents_events"))
    .values({
      id: crypto.randomUUID(),
      document_id: document.id,
      event_type: "SIGNED",
      from_status: "SIGNING_PENDING",
      to_status: "TTN_PENDING",
      metadata: null,
      created_at: new Date(),
    })
    .execute();
}
