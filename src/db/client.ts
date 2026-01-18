import "dotenv/config";

import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import type { DB, Tables } from "./schema.js";

export const suffix = "tbl_" as const;

type StripPrefix<
  K extends string,
  P extends string,
> = K extends `${P}${infer R}` ? R : never;

type TableNames<P extends string> = StripPrefix<keyof Tables<P>, P>;

export const tbl = <T extends TableNames<typeof suffix>>(
  tableName: T,
): `${typeof suffix}${T}` => {
  return `${suffix}${tableName}`;
};

export const db = new Kysely<DB>({
  dialect: new PostgresJSDialect({
    postgres: postgres(process.env.DATABASE_URL!),
  }),
});
