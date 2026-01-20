import { Kysely } from "kysely";
import crypto from "node:crypto";
import { consultDocument } from "../business-logic/ttn/ws/consult-doc.js";
import { extractRefTtnVal } from "../business-logic/ttn/ws/parse-consult-efact-response.js";
import { db, tbl } from "../db/client.js";
import type { DB } from "../db/schema.js";

export async function handleDocumentFromTTN() {
  try {
    // Fetch documents in TTN_SUBMITTED status
    const pendingDocs = await db
      .selectFrom(tbl("documents"))
      .select([
        "id",
        "operation_id",
        "document_number",
        "seller_tax_id",
        "buyer_tax_id",
      ])
      .where("status", "=", "TTN_SUBMITTED")
      .limit(100) // Process in batches
      .execute();

    if (pendingDocs.length === 0) {
      console.log("[TTN Cron] No documents in TTN_SUBMITTED status");
      return;
    }

    console.log(
      `[TTN Cron] Processing ${pendingDocs.length} documents for TTN submission`,
    );

    for (const doc of pendingDocs) {
      await processSingleDocumentForTTN(db, doc);
    }
  } catch (error) {
    console.error("[TTN Cron] Error in TTN submission:", error);
  }
}

async function processSingleDocumentForTTN(
  db: Kysely<DB>,
  doc: {
    id: string;
    operation_id: string;
    document_number: string;
    seller_tax_id: string;
    buyer_tax_id: string | null;
  },
) {
  const trx = await db.startTransaction().execute();

  try {
    // Get the artifact with signed TEIF XML
    const artifact = await trx
      .selectFrom(tbl("documents"))
      .leftJoin(
        tbl("operations"),
        `${tbl("operations")}.id`,
        `${tbl("documents")}.operation_id`,
      )
      .leftJoin(
        tbl("tkr_customers"),
        `${tbl("tkr_customers")}.id`,
        `${tbl("operations")}.customer_id`,
      )
      .select([
        `${tbl("documents")}.seller_tax_id as sellerTaxId`,
        `${tbl("tkr_customers")}.id as customerId`,
        `${tbl("tkr_customers")}.ttn_login as ttnLogin`,
        `${tbl("tkr_customers")}.ttn_password as ttnPassword`,
      ])
      .where(`${tbl("documents")}.id`, "=", doc.id)
      .executeTakeFirst();

    if (!artifact) {
      console.warn(
        `[TTN Cron] No artifact found for document ${doc.id}, skipping`,
      );
      await trx.rollback().execute();
      return;
    }

    if (!artifact.customerId) {
      console.warn(
        `[TTN Cron] No customer found for document ${doc.id}, skipping`,
      );
      await trx.rollback().execute();
      return;
    }

    if (!artifact.ttnLogin || !artifact.ttnPassword) {
      console.warn(
        `[TTN Cron] Missing TTN credentials for document ${doc.id}, skipping`,
      );
      await trx.rollback().execute();
      return;
    }

    // Decode the base64 TEIF XML

    // Submit to TTN via ngsign
    const response = await consultDocument(doc.document_number, {
      login: artifact.ttnLogin,
      password: artifact.ttnPassword,
      taxId: doc.seller_tax_id,
    });

    if (!response.success) {
      await trx
        .updateTable(tbl("documents"))
        .set({
          status: "TTN_REJECTED",
          updated_at: new Date(),
        })
        .where("id", "=", doc.id)
        .execute();

      await trx
        .insertInto(tbl("documents_events"))
        .values({
          id: crypto.randomUUID(),
          document_id: doc.id,
          event_type: "TTN_SUBMITTED",
          from_status: "TTN_SUBMITTED",
          to_status: "TTN_REJECTED",
          metadata: JSON.stringify({
            ...response,
            rejectedAt: new Date().toISOString(),
          }),
          created_at: new Date(),
        })
        .execute();

      await trx.commit().execute();

      throw new Error(
        `TTN submission failed: ${response.error || "Unknown error"}`,
      );
    }

    // Update document status to TTN_ACCEPTED
    await trx
      .updateTable(tbl("documents"))
      .set({ status: "TTN_ACCEPTED", updated_at: new Date() })
      .where("id", "=", doc.id)
      .execute();

    const ttnData = extractRefTtnVal(response.item.xmlContent);

    if (!ttnData) {
      throw new Error("Failed to extract TTN data from response XML");
    }

    // Add TTN
    await trx
      .updateTable(tbl("documents_artifacts"))
      .set({
        teif_xml: response.item.xmlContent,
        ttn_reference: ttnData.referenceTTN,
        qr_code_base64: ttnData.qrCodeBase64,
      })
      .where("document_id", "=", doc.id)
      .execute();

    // Log the event
    await trx
      .insertInto(tbl("documents_events"))
      .values({
        id: crypto.randomUUID(),
        document_id: doc.id,
        event_type: "TTN_ACCEPTED",
        from_status: "TTN_SUBMITTED",
        to_status: "TTN_ACCEPTED",
        metadata: JSON.stringify({
          ...response,
          submittedAt: new Date().toISOString(),
        }),
        created_at: new Date(),
      })
      .execute();

    await trx.commit().execute();
    console.log(`[TTN Cron] Successfully submitted document ${doc.id} to TTN`);
  } catch (error) {
    await trx.rollback().execute();
    console.error(
      `[TTN Cron] Failed to process document ${doc.id}:`,
      error instanceof Error ? error.message : error,
    );

    // Update document status to FAILED
    try {
      const errorTrx = await db.startTransaction().execute();
      await errorTrx
        .updateTable(tbl("documents"))
        .set({
          status: "FAILED",
          updated_at: new Date(),
        })
        .where("id", "=", doc.id)
        .execute();

      await errorTrx
        .insertInto(tbl("documents_events"))
        .values({
          id: crypto.randomUUID(),
          document_id: doc.id,
          event_type: "FAILED",
          from_status: "TTN_SUBMITTED",
          to_status: "TTN_REJECTED",
          metadata: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            failedAt: new Date().toISOString(),
          }),
          created_at: new Date(),
        })
        .execute();

      await errorTrx.commit().execute();
    } catch (rollbackError) {
      console.error(
        "[TTN Cron] Failed to update document status after error:",
        rollbackError,
      );
    }
  }
}
