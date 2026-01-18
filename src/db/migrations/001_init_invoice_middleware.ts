import { Kysely, sql } from "kysely";
import { suffix } from "../client.js";

const enumNames = {
  documentStatus: `${suffix}document_status`,
  documentType: `${suffix}document_type`,
  documentEventType: `${suffix}document_event_type`,
  operationStatus: `${suffix}operation_status`,
};

export async function up(db: Kysely<any>): Promise<void> {
  /**
   * ------------------------------------------------------------------
   * ENUMS (PostgreSQL)
   * ------------------------------------------------------------------
   */
  await db.schema
    .createType(enumNames.operationStatus)
    .asEnum(["PENDING", "COMPLETED", "FAILED"])
    .execute();

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
    .createType(`${suffix}tkr_customer_mode`)
    .asEnum(["TEST", "PROD"])
    .execute();
  /**
   * ------------------------------------------------------------------
   * TABLES
   * ------------------------------------------------------------------
   */

  // 2. Create table
  await db.schema
    .createTable(`${suffix}tkr_customers`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("tax_id", "text", (col) => col.notNull())
    .addColumn("mode", sql`${sql.raw(`${suffix}tkr_customer_mode`)}`, (col) =>
      col.notNull().defaultTo("TEST"),
    )
    .addColumn("ngsign_token", "text", (col) => col.notNull())
    .addColumn("ngsign_signer_email", sql`citext`, (col) => col.notNull())
    .addColumn("default_success_url", "text")
    .addColumn("default_failure_url", "text")
    .addColumn("ttn_login", "text")
    .addColumn("ttn_password", "text")
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      `${suffix}email_format_check`,
      sql`ngsign_signer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'`,
    )
    .execute();

  // 3. Create table for customer API tokens
  await db.schema
    .createTable(`${suffix}tkr_customer_tokens`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("customer_id", "uuid", (col) =>
      col.notNull().references(`${suffix}tkr_customers.id`).onDelete("cascade"),
    )
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("expiration_date", sql`timestamptz`)
    .addColumn("created_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable(`${suffix}operations`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("ngsign_uuid", "uuid")
    .addColumn("customer_id", "uuid", (col) =>
      col.notNull().references(`${suffix}tkr_customers.id`).onDelete("cascade"),
    )
    .addColumn("success_callback_url", "text", (col) => col.notNull())
    .addColumn("failure_callback_url", "text", (col) => col.notNull())
    .addColumn("status", sql`${sql.raw(enumNames.operationStatus)}`, (col) =>
      col.notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(`${suffix}operations_ngsign_uuid_unique`, [
      "ngsign_uuid",
    ])
    .execute();

  await db.schema
    .createTable(`${suffix}documents`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("operation_id", "uuid", (col) =>
      col.notNull().references(`${suffix}operations.id`).onDelete("cascade"),
    )
    .addColumn("source_system", "text", (col) => col.notNull())
    .addColumn("document_number", "text", (col) => col.notNull())
    .addColumn(
      "document_type",
      sql`${sql.raw(enumNames.documentType)}`,
      (col) => col.notNull(),
    )
    .addColumn("issue_date", "date", (col) => col.notNull())
    .addColumn("seller_tax_id", "text", (col) => col.notNull())
    .addColumn("buyer_tax_id", "text")
    .addColumn("currency", "char(3)", (col) => col.notNull())
    .addColumn("total_ht", "numeric(18, 3)", (col) => col.notNull())
    .addColumn("total_tva", "numeric(18, 3)", (col) => col.notNull())
    .addColumn("total_ttc", "numeric(18, 3)", (col) => col.notNull())
    .addColumn("status", sql`${sql.raw(enumNames.documentStatus)}`, (col) =>
      col.notNull().defaultTo("RECEIVED"),
    )
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("payload_hash", "text", (col) => col.notNull())
    .addColumn("schema_version", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(`${suffix}documents_seller_unique`, [
      "document_number",
      "seller_tax_id",
    ])
    .execute();

  await db.schema
    .createTable(`${suffix}documents_artifacts`)
    .addColumn("document_id", "uuid", (col) =>
      col.primaryKey().references(`${suffix}documents.id`).onDelete("cascade"),
    )
    .addColumn("teif_xml", "text", (col) => col.notNull())
    .addColumn("xml_hash", "text", (col) => col.notNull())
    .addColumn("signer", "text", (col) => col.notNull())
    .addColumn("certificate_sn", "text", (col) => col.notNull())
    .addColumn("certificate_issuer", "text", (col) => col.notNull())
    .addColumn("signature_hash", "text", (col) => col.notNull())
    .addColumn("signed_at", "timestamptz", (col) => col.notNull())
    .addColumn("generated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable(`${suffix}documents_events`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("document_id", "uuid", (col) =>
      col.notNull().references(`${suffix}documents.id`).onDelete("cascade"),
    )
    .addColumn(
      "event_type",
      sql`${sql.raw(enumNames.documentEventType)}`,
      (col) => col.notNull(),
    )
    .addColumn("from_status", sql`${sql.raw(enumNames.documentStatus)}`)
    .addColumn("to_status", sql`${sql.raw(enumNames.documentStatus)}`)
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  /**
   * ------------------------------------------------------------------
   * INDEXES
   * ------------------------------------------------------------------
   */
  await db.schema
    .createIndex(`${suffix}idx_operations_customer`)
    .on(`${suffix}operations`)
    .column("customer_id")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_documents_operation`)
    .on(`${suffix}documents`)
    .column("operation_id")
    .execute();

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
    .createIndex(`${suffix}idx_events_document_created_at`)
    .on(`${suffix}documents_events`)
    .columns(["document_id", "created_at"])
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_documents_document_number`)
    .on(`${suffix}documents`)
    .column("document_number")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_documents_buyer`)
    .on(`${suffix}documents`)
    .column("buyer_tax_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // DROP TABLES (reverse order)
  await db.schema.dropTable(`${suffix}documents_events`).execute();
  await db.schema.dropTable(`${suffix}documents_artifacts`).execute();
  await db.schema.dropTable(`${suffix}documents`).execute();
  await db.schema.dropTable(`${suffix}operations`).execute();
  await db.schema.dropTable(`${suffix}tkr_customer_tokens`).execute();
  await db.schema.dropTable(`${suffix}tkr_customers`).execute();

  // DROP ENUMS
  await db.schema.dropType(enumNames.documentEventType).execute();
  await db.schema.dropType(enumNames.documentType).execute();
  await db.schema.dropType(enumNames.documentStatus).execute();
  await db.schema.dropType(enumNames.operationStatus).execute();
  await db.schema.dropType(`${suffix}tkr_customer_mode`).execute();
}
