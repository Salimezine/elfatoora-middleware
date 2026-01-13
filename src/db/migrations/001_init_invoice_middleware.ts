import { Kysely, sql } from "kysely";
import { suffix } from "../client.js";

export async function up(db: Kysely<any>): Promise<void> {
  // ----------------------------
  // invoice_status enum
  // ----------------------------
  await db.schema
    .createType(`${suffix}invoice_status`)
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

  // ----------------------------
  // invoices (middleware aggregate)
  // ----------------------------
  await db.schema
    .createTable(`${suffix}invoices`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("number", "varchar", (col) => col.notNull().unique())
    .addColumn("status", sql.raw(`${suffix}invoice_status`), (col) =>
      col.notNull().defaultTo("RECEIVED")
    )
    .addColumn("client_id", "uuid", (col) => col.notNull())
    .addColumn("issued_at", "timestamptz")
    .addColumn("subtotal_ht", "numeric", (col) => col.notNull())
    .addColumn("total_tax", "numeric", (col) => col.notNull())
    .addColumn("total_ttc", "numeric", (col) => col.notNull())
    .addColumn("rules_version", "varchar", (col) => col.notNull())
    .addColumn("snapshot_json", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now"))
    )
    .execute();

  // ----------------------------
  // invoice_lines
  // ----------------------------
  await db.schema
    .createTable(`${suffix}invoice_lines`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("invoice_id", "uuid", (col) =>
      col.notNull().references(`${suffix}invoices.id`).onDelete("cascade")
    )
    .addColumn("quantity", "numeric", (col) => col.notNull())
    .addColumn("unit_price", "numeric", (col) => col.notNull())
    .addColumn("discount_rate", "numeric")
    .execute();

  // ----------------------------
  // invoice_allowances
  // ----------------------------
  await db.schema
    .createTable(`${suffix}invoice_allowances`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("invoice_id", "uuid", (col) =>
      col.notNull().references(`${suffix}invoices.id`).onDelete("cascade")
    )
    .addColumn("type", "varchar", (col) => col.notNull())
    .addColumn("amount", "numeric", (col) => col.notNull())
    .execute();

  // ----------------------------
  // invoice_events (audit / trace)
  // ----------------------------
  await db.schema
    .createTable(`${suffix}invoice_events`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("invoice_id", "uuid", (col) =>
      col.notNull().references(`${suffix}invoices.id`).onDelete("cascade")
    )
    .addColumn("type", "varchar", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now"))
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable(`${suffix}invoice_events`).execute();
  await db.schema.dropTable(`${suffix}invoice_allowances`).execute();
  await db.schema.dropTable(`${suffix}invoice_lines`).execute();
  await db.schema.dropTable(`${suffix}invoices`).execute();
  await db.schema.dropType(`${suffix}_invoice_status`).execute();
}
