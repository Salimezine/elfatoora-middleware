import "dotenv/config";

import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import type { DB } from "./schema.js";

export const suffix = "tbl_" as const;

export const db = new Kysely<DB>({
  dialect: new PostgresJSDialect({
    postgres: postgres(process.env.DATABASE_URL!),
  }),
});
