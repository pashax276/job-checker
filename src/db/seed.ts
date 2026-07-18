import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, watchlist } from "@/db/schema";
import { jobCreateSchema } from "@/lib/schemas";
import { createJob } from "@/server/jobs";

/** Pipeline companies on public ATS APIs (per the build brief). */
const WATCHLIST_SEED = [
  { displayName: "Platform Science", atsType: "greenhouse", boardSlug: "platformscience" },
  { displayName: "Babylist", atsType: "greenhouse", boardSlug: "babylist" },
  { displayName: "PrizePicks", atsType: "greenhouse", boardSlug: "prizepicks" },
  { displayName: "Ava Labs", atsType: "greenhouse", boardSlug: "avalabs" },
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

export function defaultSeedPath(): string {
  return (
    process.env.SEED_PATH ?? path.join(process.cwd(), "data", "jobs_seed.json")
  );
}

/**
 * First-run import: loads the seed file into the jobs table, but only when the
 * table is empty and the file exists. Malformed rows abort the whole import so
 * a partial seed never masquerades as a complete one.
 */
export function seedIfEmpty(
  db: DB,
  seedPath = defaultSeedPath(),
): { imported: number } {
  const existing = db.select({ n: count() }).from(jobs).get();
  if ((existing?.n ?? 0) > 0) return { imported: 0 };
  if (!fs.existsSync(seedPath)) return { imported: 0 };

  const parsed: unknown = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Seed file ${seedPath} must be a JSON array of jobs`);
  }

  db.transaction(() => {
    parsed.forEach((row, index) => {
      const result = jobCreateSchema.safeParse(row);
      if (!result.success) {
        throw new Error(
          `Seed import failed at row ${index}: ${result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }
      createJob(db, result.data);
    });
  });

  return { imported: parsed.length };
}
