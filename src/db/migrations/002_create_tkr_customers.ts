import { Kysely, sql } from "kysely";
import { suffix } from "../client.js";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Create enum type for mode
  await db.schema
    .createType(`${suffix}tkr_customer_mode`)
    .asEnum(["TEST", "PROD"])
    .execute();

  // 2. Create table
  await db.schema
    .createTable(`${suffix}tkr_customers`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("tax_id", "text", (col) => col.notNull())
    .addColumn("mode", sql`${suffix}tkr_customer_mode`, (col) =>
      col.notNull().defaultTo("TEST")
    )
    .addColumn("ngsign_token", "text", (col) => col.notNull())
    .addColumn("ngsign_signer_email", "text", (col) => col.notNull())
    .addColumn("default_success_url", "text")
    .addColumn("default_failure_url", "text")
    .addColumn("ttn_login", "text")
    .addColumn("ttn_password", "text")
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // 3. Create table for customer API tokens
  await db.schema
    .createTable(`${suffix}tkr_customer_tokens`)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("customer_id", "uuid", (col) =>
      col.notNull().references(`${suffix}tkr_customers.id`).onDelete("cascade")
    )
    .addColumn("token", "text", (col) => col.notNull().unique())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("expiration_date", sql`timestamptz`)
    .addColumn("created_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // 1. Drop table
  await db.executeQuery(
    sql`DROP TABLE IF EXISTS ${suffix}tkr_customers`.compile(db)
  );

  // 2. Drop enum type
  await db.executeQuery(
    sql`DROP TYPE IF EXISTS ${suffix}tkr_customer_mode`.compile(db)
  );

  // 3. Drop customer tokens table
  await db.executeQuery(
    sql`DROP TABLE IF EXISTS ${suffix}tkr_customer_tokens`.compile(db)
  );
}
