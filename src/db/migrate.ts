import { promises as fs } from "fs";
import { FileMigrationProvider, Migrator } from "kysely";
import path from "path";
import { db } from "./client.js";

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(process.cwd(), "src/db/migrations"),
  }),
});

const { error, results } = await migrator.migrateToLatest();

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`✔ ${it.migrationName}`);
  } else if (it.status === "Error") {
    console.error(`✖ ${it.migrationName}`);
  }
});

if (error) {
  console.error(error);
  process.exit(1);
}

await db.destroy();
