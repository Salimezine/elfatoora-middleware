import { Kysely } from "kysely";
import { suffix } from "../client.js";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${suffix}documents_artifacts`)
    .addColumn("qr_code_base64", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable(`${suffix}documents_artifacts`)
    .dropColumn("qr_code_base64")
    .execute();
}
