import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { eddReports, type EddReportRecord } from "@/db/schema";
import type { EddStage } from "@/lib/constants";
import type { EddReportSet } from "@/lib/schemas";

/** A job's EDD reports, oldest report first. */
export function listEddReports(db: DB, jobId: string): EddReportRecord[] {
  return db
    .select()
    .from(eddReports)
    .where(eq(eddReports.jobId, jobId))
    .orderBy(asc(eddReports.reportedOn), asc(eddReports.createdAt))
    .all();
}

/** Mark a stage as reported to EDD — one report per stage per job. */
export function setEddReport(
  db: DB,
  jobId: string,
  input: EddReportSet,
  now = new Date(),
): EddReportRecord {
  db.insert(eddReports)
    .values({
      id: randomUUID(),
      jobId,
      stage: input.stage,
      reportedOn: input.reportedOn,
      createdAt: now.toISOString(),
    })
    // Marking a stage again corrects its date; createdAt stays as the moment
    // it was first marked, which is what orders same-day rows in the timeline.
    .onConflictDoUpdate({
      target: [eddReports.jobId, eddReports.stage],
      set: { reportedOn: input.reportedOn },
    })
    .run();
  return db
    .select()
    .from(eddReports)
    .where(and(eq(eddReports.jobId, jobId), eq(eddReports.stage, input.stage)))
    .get()!;
}

export function clearEddReport(db: DB, jobId: string, stage: EddStage): boolean {
  return (
    db
      .delete(eddReports)
      .where(and(eq(eddReports.jobId, jobId), eq(eddReports.stage, stage)))
      .run().changes > 0
  );
}

/**
 * Reported stages for every job in one query, for the list views' badge —
 * a per-row lookup would be one query per card on the board.
 */
export function listEddStagesByJob(db: DB): Map<string, string[]> {
  const rows = db
    .select({ jobId: eddReports.jobId, stage: eddReports.stage })
    .from(eddReports)
    .orderBy(asc(eddReports.reportedOn), asc(eddReports.createdAt))
    .all();
  const byJob = new Map<string, string[]>();
  for (const row of rows) {
    byJob.set(row.jobId, [...(byJob.get(row.jobId) ?? []), row.stage]);
  }
  return byJob;
}
