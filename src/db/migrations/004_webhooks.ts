import { Kysely, sql } from "kysely";
import { suffix } from "../client.js";

const enumNames = {
  webhookDeliveryStatus: `${suffix}webhook_delivery_status`,
  documentEventType: `${suffix}document_event_type`,
};

export async function up(db: Kysely<any>): Promise<void> {
  /**
   * ------------------------------------------------------------------
   * ENUMS (PostgreSQL)
   * ------------------------------------------------------------------
   */
  await db.schema
    .createType(enumNames.webhookDeliveryStatus)
    .asEnum(["PENDING", "DELIVERED", "FAILED"])
    .execute();

  /**
   * ------------------------------------------------------------------
   * WEBHOOK_ENDPOINTS TABLE
   * ------------------------------------------------------------------
   * Stores customer webhook subscriptions
   */
  await db.schema
    .createTable(`${suffix}webhook_endpoints`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("customer_id", "uuid", (col) =>
      col.notNull().references(`${suffix}tkr_customers.id`).onDelete("cascade"),
    )
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("secret", "text", (col) => col.notNull())
    .addColumn("events", sql`text[]`, (col) =>
      col.notNull().defaultTo(sql`ARRAY[]::text[]`),
    )
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(`${suffix}webhook_endpoints_unique`, [
      "customer_id",
      "url",
    ])
    .execute();

  /**
   * ------------------------------------------------------------------
   * WEBHOOK_DELIVERIES TABLE (OUTBOX PATTERN)
   * ------------------------------------------------------------------
   * Event-driven outbox for reliable webhook delivery
   */
  await db.schema
    .createTable(`${suffix}webhook_deliveries`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("webhook_id", "uuid", (col) =>
      col
        .notNull()
        .references(`${suffix}webhook_endpoints.id`)
        .onDelete("cascade"),
    )
    .addColumn("document_event_id", "uuid", (col) =>
      col
        .notNull()
        .references(`${suffix}documents_events.id`)
        .onDelete("cascade"),
    )
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("payload_hash", "text", (col) => col.notNull())
    .addColumn(
      "status",
      sql`${sql.raw(enumNames.webhookDeliveryStatus)}`,
      (col) => col.notNull().defaultTo("PENDING"),
    )
    .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_attempt_at", sql`timestamptz`)
    .addColumn("next_retry_at", sql`timestamptz`)
    .addColumn("last_error", "text")
    .addColumn("created_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  /**
   * ------------------------------------------------------------------
   * INDEXES
   * ------------------------------------------------------------------
   */
  await db.schema
    .createIndex(`${suffix}idx_webhook_endpoints_customer`)
    .on(`${suffix}webhook_endpoints`)
    .column("customer_id")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_webhook_endpoints_active`)
    .on(`${suffix}webhook_endpoints`)
    .columns(["is_active", "customer_id"])
    .execute();

  // Critical index for delivery worker polling
  // Note: Partial indexes not fully supported in all Kysely versions,
  // so we create the full index and filter in the query
  await db.schema
    .createIndex(`${suffix}idx_webhook_deliveries_next_retry`)
    .on(`${suffix}webhook_deliveries`)
    .columns(["status", "next_retry_at"])
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_webhook_deliveries_webhook`)
    .on(`${suffix}webhook_deliveries`)
    .column("webhook_id")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_webhook_deliveries_document_event`)
    .on(`${suffix}webhook_deliveries`)
    .column("document_event_id")
    .execute();

  await db.schema
    .createIndex(`${suffix}idx_webhook_deliveries_created_at`)
    .on(`${suffix}webhook_deliveries`)
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // DROP TABLES
  await db.schema.dropTable(`${suffix}webhook_deliveries`).execute();
  await db.schema.dropTable(`${suffix}webhook_endpoints`).execute();

  // DROP ENUMS
  await db.schema.dropType(enumNames.webhookDeliveryStatus).execute();
}
