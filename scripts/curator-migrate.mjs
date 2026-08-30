import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { backupContentDb, openContentDb } from "./curator-db.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = path.resolve(process.env.CURATOR_CONTENT_DB || path.join(ROOT, ".curator", "content.sqlite"));

function snapshot(db) {
  const version = Number(db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()?.version || 0);
  const columns = db.prepare("PRAGMA table_info(content_items)").all().map((column) => String(column.name));
  const counts = db.prepare("SELECT block_type AS block, status, COUNT(*) AS count FROM content_items GROUP BY block_type, status ORDER BY block_type, status").all();
  return { schemaVersion: version, columns, counts };
}

function forceEditorialDrafts(db) {
  return db.prepare("UPDATE content_items SET status = 'draft' WHERE block_type IN ('skill', 'project') AND status != 'draft'").run().changes;
}

export async function migrate({ write = false } = {}) {
  await fs.access(DB_FILE);
  if (!write) {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "curator-migrate-"));
    const temporaryDb = path.join(temporaryRoot, "content.sqlite");
    await fs.copyFile(DB_FILE, temporaryDb);
    try {
      const db = await openContentDb({ file: temporaryDb });
      const changedStatuses = forceEditorialDrafts(db);
      const result = { dryRun: true, database: DB_FILE, backup: null, changedStatuses, ...snapshot(db) };
      db.close();
      return result;
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  const backup = await backupContentDb({ file: DB_FILE });
  const db = await openContentDb({ file: DB_FILE });
  const changedStatuses = forceEditorialDrafts(db);
  const result = { dryRun: false, database: DB_FILE, backup, changedStatuses, ...snapshot(db) };
  db.close();
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate({ write: process.argv.includes("--write") })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.dryRun) console.log("Dry run only. Use --write to migrate the SQLite database.");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
