import fs from "node:fs";
import path from "node:path";
import { defaultDbPath, type DB } from "@/db/client";
import { toLocalIsoDate } from "@/lib/dates";

export const BACKUP_RETENTION = 14;

/** Backups live next to the database (on the /data volume in Docker). */
export function backupsDir(): string {
  return (
    process.env.BACKUPS_DIR ??
    path.join(path.dirname(defaultDbPath()), "backups")
  );
}

const BACKUP_FILE_RE = /^tracker-\d{4}-\d{2}-\d{2}\.db$/;

/**
 * One dated snapshot per day (idempotent — reruns overwrite), WAL folded in
 * first so the copy is complete, oldest snapshots pruned past retention.
 */
export async function runBackup(
  db: DB,
  dir = backupsDir(),
  today = new Date(),
): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  db.$client.pragma("wal_checkpoint(TRUNCATE)");
  const dest = path.join(dir, `tracker-${toLocalIsoDate(today)}.db`);
  await db.$client.backup(dest);

  const files = fs
    .readdirSync(dir)
    .filter((f) => BACKUP_FILE_RE.test(f))
    .sort();
  for (const file of files.slice(0, Math.max(0, files.length - BACKUP_RETENTION))) {
    fs.rmSync(path.join(dir, file), { force: true });
  }
  return dest;
}
