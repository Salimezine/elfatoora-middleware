import { promises as fs } from "fs";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import path from "path";
import { db } from "./client.js";

const migrationFolder = path.join(
  process.cwd(),
  process.env["MIGRATION_DIR"] ?? "src/db/migrations",
);

const fileUrlImport = (filePath: string) => {
  const url = filePath.startsWith("file://")
    ? filePath
    : "file:///" + filePath.replace(/\\/g, "/");
  return import(url);
};

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
    import: fileUrlImport,
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
