import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, stageSchedule, type StageScheduleRecord } from "@/db/schema";
import type { Status } from "@/lib/constants";

export function listSchedule(db: DB, jobId: string): StageScheduleRecord[] {
  return db
    .select()
    .from(stageSchedule)
    .where(eq(stageSchedule.jobId, jobId))
    .orderBy(asc(stageSchedule.scheduledFor))
    .all();
}

/** Book (or rebook) a stage's date — one date per stage per job. */
export function upsertStageSchedule(
  db: DB,
  jobId: string,
  stage: Status,
  scheduledFor: string,
): StageScheduleRecord {
  const record: StageScheduleRecord = {
    id: randomUUID(),
    jobId,
    stage,
    scheduledFor,
  };
  db.insert(stageSchedule)
    .values(record)
    .onConflictDoUpdate({
      target: [stageSchedule.jobId, stageSchedule.stage],
      set: { scheduledFor },
    })
    .run();
  // Booking the Applied step IS the application date — keep the job in sync.
  if (stage === "Applied") {
    db.update(jobs)
      .set({ dateApplied: scheduledFor })
      .where(eq(jobs.id, jobId))
      .run();
  }
  return db
    .select()
    .from(stageSchedule)
    .where(and(eq(stageSchedule.jobId, jobId), eq(stageSchedule.stage, stage)))
    .get()!;
}

export function removeStageSchedule(
  db: DB,
  jobId: string,
  stage: Status,
): boolean {
  return (
    db
      .delete(stageSchedule)
      .where(and(eq(stageSchedule.jobId, jobId), eq(stageSchedule.stage, stage)))
      .run().changes > 0
  );
}
