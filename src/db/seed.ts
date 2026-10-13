import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { jobs, statusHistory, watchlist } from "@/db/schema";
import { STATUSES } from "@/lib/constants";
import { jobCreateSchema } from "@/lib/schemas";

export function defaultSeedPath(): string {
  return (
    process.env.SEED_PATH ?? path.join(process.cwd(), "data", "jobs_seed.json")
  );
}

// The Excel exporter emits full job records: jobCreate fields plus
// timestamps and a (possibly empty) status history.
const seedHistoryEntrySchema = z.strictObject({
  id: z.string().min(1).optional(),
  fromStatus: z.enum(STATUSES).nullable(),
  toStatus: z.enum(STATUSES),
  changedAt: z.string().min(1),
});

const seedRowSchema = jobCreateSchema.extend({
  createdAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
  statusHistory: z.array(seedHistoryEntrySchema).optional(),
});

function extractRows(raw: unknown, seedPath: string): unknown[] {
  // Accept either a bare array or the exporter's envelope
  // ({ exportedAt, source, jobs: [...] }).
  if (Array.isArray(raw)) return raw;
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { jobs?: unknown }).jobs)
  ) {
    return (raw as { jobs: unknown[] }).jobs;
  }
  throw new Error(
    `Seed file ${seedPath} must be a JSON array of jobs (or { jobs: [...] })`,
  );
}

/**
 * First-run import: loads the seed file into the jobs table, but only when the
 * table is empty and the file exists. Supplied timestamps and status history
 * are preserved; rows without history get the standard initial entry.
 * Malformed rows abort the whole import so a partial seed never masquerades
 * as a complete one.
 */
export function seedIfEmpty(
  db: DB,
  seedPath = defaultSeedPath(),
): { imported: number } {
  const existing = db.select({ n: count() }).from(jobs).get();
  if ((existing?.n ?? 0) > 0) return { imported: 0 };
  if (!fs.existsSync(seedPath)) return { imported: 0 };

  const rows = extractRows(
    JSON.parse(fs.readFileSync(seedPath, "utf8")),
    seedPath,
  );

  db.transaction(() => {
    rows.forEach((row, index) => {
      const result = seedRowSchema.safeParse(row);
      if (!result.success) {
        throw new Error(
          `Seed import failed at row ${index}: ${result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }
      const { statusHistory: history, createdAt, updatedAt, ...jobInput } =
        result.data;
      const id = jobInput.id ?? randomUUID();
      const created = createdAt ?? new Date().toISOString();

      db.insert(jobs)
        .values({
          ...jobInput,
          id,
          source: "import",
          createdAt: created,
          updatedAt: updatedAt ?? created,
        })
        .run();

      const entries =
        history && history.length > 0
          ? history
          : [{ fromStatus: null, toStatus: jobInput.status, changedAt: created }];
      for (const entry of entries) {
        db.insert(statusHistory)
          .values({
            ...entry,
            id: ("id" in entry ? entry.id : undefined) ?? randomUUID(),
            jobId: id,
          })
          .run();
      }
    });
  });

  return { imported: rows.length };
}

/** Pipeline companies on public ATS APIs (per the build brief). */
const WATCHLIST_SEED = [
  { displayName: "Platform Science", atsType: "greenhouse", boardSlug: "platformscience" },
  { displayName: "Babylist", atsType: "greenhouse", boardSlug: "babylist" },
  { displayName: "PrizePicks", atsType: "greenhouse", boardSlug: "prizepicks" },
  // moved off Greenhouse (boards/avalabs now 404s) to jobs.ashbyhq.com/ava-labs
  { displayName: "Ava Labs", atsType: "ashby", boardSlug: "ava-labs" },
  { displayName: "Talkiatry", atsType: "ashby", boardSlug: "talkiatry" },
] as const;

/** Seed the discovery watchlist once; users manage it in Settings afterwards. */
export function seedWatchlistIfEmpty(db: DB): { imported: number } {
  const existing = db.select({ n: count() }).from(watchlist).get();
  if ((existing?.n ?? 0) > 0) return { imported: 0 };
  for (const entry of WATCHLIST_SEED) {
    db.insert(watchlist)
      .values({ id: randomUUID(), enabled: true, ...entry })
      .run();
  }
  return { imported: WATCHLIST_SEED.length };
}
