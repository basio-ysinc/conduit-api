import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type Db = Database.Database;

const migrationsDir = fileURLToPath(new URL("./migrations/", import.meta.url));

/**
 * SQLite を開き、src/db/migrations/*.sql を名前順に適用する。
 * 適用済みは schema_migrations に記録し、二度目は飛ばす。
 */
export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((r) => (r as { name: string }).name),
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const insert = db.prepare("INSERT INTO schema_migrations (name) VALUES (?)");
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(`${migrationsDir}${file}`, "utf8");
    db.transaction(() => {
      db.exec(sql);
      insert.run(file);
    })();
  }
  return db;
}
