import { Kysely, sql } from "kysely";
import { suffix } from "../client.js";

const enumNames = {
  documentStatus: `${suffix}document_status`,
  documentType: `${suffix}document_type`,
  documentEventType: `${suffix}document_event_type`,
  submissionStatus: `${suffix}submission_status`,
};

export async function up(db: Kysely<any>): Promise<void> {
  /**
   * ------------------------------------------------------------------
   * ENUMS (PostgreSQL)
   * ------------------------------------------------------------------
   */
  await db.schema
    .createType(enumNames.documentStatus)
    .asEnum([
      "RECEIVED",
      "SIGNING_PENDING",
      "SIGNED",
      "SIGNING_FAILED",
      "TTN_PENDING",
      "TTN_SUBMITTED",
      "TTN_ACCEPTED",
      "TTN_REJECTED",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ])
    .execute();

  await db.schema
    .createType(enumNames.documentType)
    .asEnum(["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"])
    .execute();

  await db.schema
    .createType(enumNames.documentEventType)
    .asEnum([
      "RECEIVED",
      "SIGNING_REQUESTED",
      "SIGNED",
      "SIGNING_FAILED",
      "TTN_SUBMISSION_REQUESTED",
      "TTN_SUBMITTED",
      "TTN_ACCEPTED",
      "TTN_REJECTED",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "RETRIED",
      "STATUS_CHANGED",
    ])
    .execute();

  await db.schema
    .createType(enumNames.submissionStatus)
    .asEnum(["SENT", "ACCEPTED", "REJECTED", "TIMEOUT"])
    .execute();

  /**
   * ------------------------------------------------------------------
   * TABLES
   * ------------------------------------------------------------------
   */

  await db.schema
    .createTable(`${suffix}documents`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("external_document_id", "text", (col) => col.notNull())
    .addColumn("source_system", "text", (col) => col.notNull())
    .addColumn("document_number", "text", (col) => col.notNull())
    .addColumn(
      "document_type",
      sql`${sql.raw(enumNames.documentType)}`,
      (col) => col.notNull()
    )
    .addColumn("issue_date", "date", (col) => col.notNull())
    .addColumn("seller_tax_id", "text", (col) => col.notNull())
    .addColumn("buyer_tax_id", "text")
    .addColumn("currency", "char(3)", (col) => col.notNull())
    .addColumn("total_ht", "numeric(18, 3)", (col) => col.notNull())
    .addColumn("total_tva", "numeric(18, 3)", (col) => col.notNull())
    .addColumn("total_ttc", "numeric(18, 3)", (col) => col.notNull())
    .addColumn("status", sql`${sql.raw(enumNames.documentStatus)}`, (col) =>
      col.notNull().defaultTo("RECEIVED")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint(`${suffix}documents_external_seller_unique`, [
      "external_document_id",
      "seller_tax_id",
    ])
    .execute();

  await db.schema
    .createTable(`${suffix}document_payloads`)
    .addColumn("document_id", "uuid", (col) =>
      col.primaryKey().references(`${suffix}documents.id`).onDelete("cascade")
    )
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("payload_hash", "text", (col) => col.notNull())
    .addColumn("schema_version", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable(`${suffix}document_artifacts`)
    .addColumn("document_id", "uuid", (col) =>
      col.primaryKey().references(`${suffix}documents.id`).onDelete("cascade")
    )
    .addColumn("teif_xml", "text", (col) => col.notNull())
    .addColumn("xml_hash", "text", (col) => col.notNull())
    .addColumn("signer", "text", (col) => col.notNull())
    .addColumn("certificate_sn", "text", (col) => col.notNull())
    .addColumn("certificate_issuer", "text", (col) => col.notNull())
    .addColumn("signature_hash", "text", (col) => col.notNull())
    .addColumn("signed_at", "timestamptz", (col) => col.notNull())
    .addColumn("generated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable(`${suffix}invoice_submissions`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("document_id", "uuid", (col) =>
      col.notNull().references(`${suffix}documents.id`).onDelete("cascade")
    )
    .addColumn("authority", "text", (col) => col.notNull())
    .addColumn("request_payload", "jsonb")
    .addColumn("response_payload", "jsonb")
    .addColumn("authority_uuid", "text")
    .addColumn("status", sql`${sql.raw(enumNames.submissionStatus)}`, (col) =>
      col.notNull()
    )
    .addColumn("error_code", "text")
    .addColumn("error_message", "text")
    .addColumn("attempt", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("submitted_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable(`${suffix}document_events`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("document_id", "uuid", (col) =>
      col.notNull().references(`${suffix}documents.id`).onDelete("cascade")
    )
    .addColumn(
      "event_type",
      sql`${sql.raw(enumNames.documentEventType)}`,
      (col) => col.notNull()
    )
    .addColumn("from_status", sql`${sql.raw(enumNames.documentStatus)}`)
    .addColumn("to_status", sql`${sql.raw(enumNames.documentStatus)}`)
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  /**
   * ------------------------------------------------------------------
   * INDEXES
   * ------------------------------------------------------------------
   */

  await db.schema
    .createIndex(`${suffix}idx_documents_status`)
    .on(`${suffix}documents`)
    .column("status")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_documents_issue_date`)
    .on(`${suffix}documents`)
    .column("issue_date")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_documents_seller`)
    .on(`${suffix}documents`)
    .column("seller_tax_id")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_submissions_document`)
    .on(`${suffix}invoice_submissions`)
    .column("document_id")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_events_document`)
    .on(`${suffix}document_events`)
    .column("document_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  /**
   * ------------------------------------------------------------------
   * DROP TABLES (reverse order)
   * ------------------------------------------------------------------
   */

  await db.schema.dropTable(`${suffix}document_events`).execute();
  await db.schema.dropTable(`${suffix}invoice_submissions`).execute();
  await db.schema.dropTable(`${suffix}document_artifacts`).execute();
  await db.schema.dropTable(`${suffix}document_payloads`).execute();
  await db.schema.dropTable(`${suffix}documents`).execute();

  /**
   * ------------------------------------------------------------------
   * DROP ENUMS
   * ------------------------------------------------------------------
   */

  await db.schema.dropType(enumNames.documentEventType).execute();
  await db.schema.dropType(enumNames.submissionStatus).execute();
  await db.schema.dropType(enumNames.documentType).execute();
  await db.schema.dropType(enumNames.documentStatus).execute();
}
