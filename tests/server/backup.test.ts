import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import { BACKUP_RETENTION, runBackup } from "@/server/backup";
import { createJob } from "@/server/jobs";

const TODAY = new Date(2026, 6, 19, 12, 0, 0);

let db: DB;
let dir: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  dir = path.join(os.tmpdir(), `backup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
});

describe("runBackup", () => {
  it("writes a dated, readable backup containing the data", async () => {
    createJob(db, jobCreateSchema.parse({ company: "Acme", role: "SRE" }));
    const dest = await runBackup(db, dir, TODAY);
    expect(dest.endsWith("tracker-2026-07-19.db")).toBe(true);
    const copy = new Database(dest, { readonly: true });
    const row = copy.prepare("SELECT COUNT(*) n FROM jobs").get() as { n: number };
    expect(row.n).toBe(1);
    copy.close();
  });

  it("is idempotent per day (same file overwritten)", async () => {
    await runBackup(db, dir, TODAY);
    await runBackup(db, dir, TODAY);
    expect(
      fs.readdirSync(dir).filter((f) => f.startsWith("tracker-")),
    ).toHaveLength(1);
  });

  it("prunes old backups beyond the retention window", async () => {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= BACKUP_RETENTION + 5; i++) {
      fs.writeFileSync(
        path.join(dir, `tracker-2026-06-${String(i).padStart(2, "0")}.db`),
        "old",
      );
    }
    await runBackup(db, dir, TODAY);
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("tracker-"));
    expect(files).toHaveLength(BACKUP_RETENTION);
    expect(files).toContain("tracker-2026-07-19.db");
    expect(files).not.toContain("tracker-2026-06-01.db");
  });
});
