import { ControlledTransaction } from "kysely";
import crypto from "node:crypto";
import { suffix } from "../../db/client.js";
import type { DB } from "../../db/schema.js";
import type { Document } from "../../schemas/document.schema.js";

export async function saveIncomingDocuments(
  trx: ControlledTransaction<DB, []>,
  input: Document[]
) {
  /**
   * ------------------------------------------------------------------
   * 1. Insert document (aggregate root)
   * ------------------------------------------------------------------
   */

  const documents = await trx
    .insertInto(`${suffix}documents`)
    .values(
      input.map((doc) => ({
        external_document_id: doc.header.documentNumber,
        source_system: "api", // or doc.source if available

        document_number: doc.header.documentNumber,
        document_type: doc.header.type,
        issue_date: new Date(doc.header.issueDate),

        seller_tax_id: doc.seller.identifier,
        buyer_tax_id: doc.buyer?.identifier ?? null,

        currency: doc.totals.totalTTC.currency,
        total_ht: doc.totals.subtotalHT.amount.toString(),
        total_tva: doc.totals.totalTax.amount.toString(),
        total_ttc: doc.totals.totalTTC.amount.toString(),

        status: "SIGNING_PENDING",

        created_at: new Date(),
        updated_at: new Date(),
      }))
    )
    .returning(["id", "external_document_id as externalDocumentId"])
    .execute();

  /**
   * ------------------------------------------------------------------
   * 2. Store original payload (optional but recommended)
   * ------------------------------------------------------------------
   */

  const payloadInserts = documents.map((doc, index) => ({
    document_id: doc.id,
    payload: input[index],
    payload_hash: crypto
      .createHash("sha256")
      .update(JSON.stringify(input[index]))
      .digest("hex"),
    schema_version: "v1",
    created_at: new Date(),
  }));
  await trx
    .insertInto(`${suffix}document_payloads`)
    .values(payloadInserts)
    .execute();

  /**
   * ------------------------------------------------------------------
   * 3. Audit event
   * ------------------------------------------------------------------
   */
  const insertEvents = documents.map((doc) => ({
    document_id: doc.id,
    event_type: "SIGNING_REQUESTED" as const,
    from_status: "RECEIVED" as const,
    to_status: "SIGNING_PENDING" as const,
    metadata: {
      source: "incoming-api",
    },
    created_at: new Date(),
  }));
  await trx
    .insertInto(`${suffix}document_events`)
    .values(insertEvents)
    .execute();

  return documents;
}
