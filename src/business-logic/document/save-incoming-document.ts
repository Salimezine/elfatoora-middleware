import { Kysely } from "kysely";
import crypto from "node:crypto";
import { suffix } from "../../db/client.js";
import type { DB } from "../../db/schema.js";
import type { Document } from "../../schemas/document.schema.js";

export async function saveIncomingDocument(db: Kysely<DB>, input: Document) {
  return db.transaction().execute(async (trx) => {
    /**
     * ------------------------------------------------------------------
     * 1. Insert document (aggregate root)
     * ------------------------------------------------------------------
     */

    const document = await trx
      .insertInto(`${suffix}documents`)
      .values({
        external_document_id: input.header.documentNumber,
        source_system: "api", // or input.source if available

        document_number: input.header.documentNumber,
        document_type: "INVOICE",
        issue_date: new Date(input.header.issueDate),

        seller_tax_id: input.seller.identifier,
        buyer_tax_id: input.buyer?.identifier ?? null,

        currency: input.totals.totalTTC.currency,
        total_ht: input.totals.subtotalHT.amount.toString(),
        total_tva: input.totals.totalTax.amount.toString(),
        total_ttc: input.totals.totalTTC.amount.toString(),

        status: "RECEIVED",

        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const documentId = document.id;

    /**
     * ------------------------------------------------------------------
     * 2. Store original payload (optional but recommended)
     * ------------------------------------------------------------------
     */

    await trx
      .insertInto(`${suffix}document_payloads`)
      .values({
        document_id: documentId,
        payload: input,
        payload_hash: crypto
          .createHash("sha256")
          .update(JSON.stringify(input))
          .digest("hex"),
        schema_version: "v1",
        created_at: new Date(),
      })
      .execute();

    /**
     * ------------------------------------------------------------------
     * 3. Audit event
     * ------------------------------------------------------------------
     */

    await trx
      .insertInto(`${suffix}document_events`)
      .values({
        document_id: documentId,
        event_type: "RECEIVED",
        from_status: null,
        to_status: "RECEIVED",
        metadata: {
          source: "incoming-api",
        },
        created_at: new Date(),
      })
      .execute();

    return documentId;
  });
}
