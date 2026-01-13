import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // ----------------------------
  // invoices (aggregate root)
  // ----------------------------
  await db.schema
    .createTable("invoices")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("number", "varchar", (col) => col.notNull().unique())
    .addColumn("status", "varchar", (col) => col.notNull())
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
    .createTable("invoice_lines")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("invoice_id", "uuid", (col) =>
      col.notNull().references("invoices.id").onDelete("cascade")
    )
    .addColumn("quantity", "numeric", (col) => col.notNull())
    .addColumn("unit_price", "numeric", (col) => col.notNull())
    .addColumn("discount_rate", "numeric")
    .execute();

  // ----------------------------
  // invoice_allowances
  // ----------------------------
  await db.schema
    .createTable("invoice_allowances")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("invoice_id", "uuid", (col) =>
      col.notNull().references("invoices.id").onDelete("cascade")
    )
    .addColumn("type", "varchar", (col) => col.notNull()) // DISCOUNT | SURCHARGE | WITHHOLDING
    .addColumn("amount", "numeric", (col) => col.notNull())
    .execute();

  // ----------------------------
  // invoice_events (audit trail)
  // ----------------------------
  await db.schema
    .createTable("invoice_events")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid"))
    )
    .addColumn("invoice_id", "uuid", (col) =>
      col.notNull().references("invoices.id").onDelete("cascade")
    )
    .addColumn("type", "varchar", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now"))
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("invoice_events").execute();
  await db.schema.dropTable("invoice_allowances").execute();
  await db.schema.dropTable("invoice_lines").execute();
  await db.schema.dropTable("invoices").execute();
}
