import { Kysely } from "kysely";
import { suffix } from "../client.js";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${suffix}documents_artifacts`)
    .addColumn("ttn_reference", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${suffix}documents_artifacts`)
    .dropColumn("ttn_reference")
    .execute();
}
