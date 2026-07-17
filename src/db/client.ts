import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DB = ReturnType<typeof createDb>;

export function defaultDbPath(): string {
  return (
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "tracker.db")
  );
}

export function createDb(dbPath: string): ReturnType<typeof drizzle<typeof schema>> {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export function migrateDb(db: DB): void {
  migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}

let singleton: DB | null = null;
let migrated = false;

/** Lazily opened process-wide handle; migrations run once via runMigrations(). */
export function getDb(): DB {
  if (!singleton) {
    singleton = createDb(defaultDbPath());
  }
  return singleton;
}

export function runMigrations(): void {
  migrateDb(getDb());
  migrated = true;
}

/** Readiness signal: DB handle open and migrations applied. */
export function isDbReady(): boolean {
  if (!migrated) return false;
  try {
    getDb().$client.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}
