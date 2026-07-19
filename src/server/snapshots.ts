import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, snapshots } from "@/db/schema";
import {
  ACTIVE_EXCLUDED_STATUSES,
  STATUSES,
  type Status,
} from "@/lib/constants";
import { toLocalIsoDate } from "@/lib/dates";

/** Monday of the given date's week, as local YYYY-MM-DD. */
export function weekStartIso(d: Date): string {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return toLocalIsoDate(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff),
  );
}

export function listSnapshots(db: DB, limit = 26) {
  return db
    .select()
    .from(snapshots)
    .orderBy(asc(snapshots.weekStart))
    .limit(limit)
    .all();
}

/**
 * Capture the pipeline's shape once per ISO week (idempotent — safe to call
 * on every boot and every cron tick). Feeds the momentum trend.
 */
export function ensureWeeklySnapshot(
  db: DB,
  today = new Date(),
): { created: boolean } {
  const week = weekStartIso(today);
  const existing = db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(eq(snapshots.weekStart, week))
    .get();
  if (existing) return { created: false };

  const rows = db
    .select({ status: jobs.status, tier: jobs.priorityTier, n: count() })
    .from(jobs)
    .groupBy(jobs.status, jobs.priorityTier)
    .all();
  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [s, 0]),
  ) as Record<Status, number>;
  let totalJobs = 0;
  let activeTotal = 0;
  for (const row of rows) {
    statusCounts[row.status as Status] += row.n;
    totalJobs += row.n;
    if (
      row.tier !== "Closed" &&
      !ACTIVE_EXCLUDED_STATUSES.includes(row.status as Status)
    ) {
      activeTotal += row.n;
    }
  }

  db.insert(snapshots)
    .values({
      id: randomUUID(),
      weekStart: week,
      takenAt: new Date().toISOString(),
      activeTotal,
      totalJobs,
      statusCounts: JSON.stringify(statusCounts),
    })
    .run();
  return { created: true };
}
