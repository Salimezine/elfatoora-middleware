import { Kysely, sql } from "kysely";
import { suffix } from "../client.js";

export type TkrSignatureStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface TkrSignatureCallbackTable {
  uuid: string;
  document_id: string;
  customer_id: string;
  success_callback_url: string;
  failure_callback_url: string;
  status: TkrSignatureStatus;
  created_at: Date;
  updated_at: Date;
}

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType(`${suffix}tkr_signature_callback_status`)
    .asEnum(["PENDING", "COMPLETED", "FAILED"])
    .execute();

  await db.schema
    .createTable(`${suffix}tkr_signature_callback`)
    .addColumn("uuid", "varchar", (col) => col.notNull())
    .addColumn("document_id", "uuid", (col) =>
      col.notNull().references(`${suffix}documents.id`)
    )
    .addColumn("customer_id", "uuid", (col) =>
      col.notNull().references(`${suffix}tkr_customers.id`)
    )
    .addColumn("success_callback_url", "varchar", (col) => col.notNull())
    .addColumn("failure_callback_url", "varchar", (col) => col.notNull())
    .addColumn(
      "status",
      sql`${sql.raw(`${suffix}tkr_signature_callback_status`)}`,
      (col) => col.notNull()
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addUniqueConstraint(`${suffix}tkr_signature_callback_unique`, [
      "uuid",
      "document_id",
      "customer_id",
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.executeQuery(
    sql`DROP TABLE IF EXISTS ${suffix}tkr_signature_callback`.compile(db)
  );

  await db.executeQuery(
    sql`DROP TYPE IF EXISTS ${suffix}tkr_signature_callback_status`.compile(db)
  );
}
