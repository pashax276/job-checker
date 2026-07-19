import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, stageSchedule, type StageScheduleRecord } from "@/db/schema";
import type { Status } from "@/lib/constants";

export interface ScheduleWithJob {
  jobId: string;
  company: string;
  role: string;
  stage: string;
  scheduledFor: string;
}

/** Every booked step joined with its job — feeds the ICS calendar. */
export function listAllSchedules(db: DB): ScheduleWithJob[] {
  return db
    .select({
      jobId: stageSchedule.jobId,
      company: jobs.company,
      role: jobs.role,
      stage: stageSchedule.stage,
      scheduledFor: stageSchedule.scheduledFor,
    })
    .from(stageSchedule)
    .innerJoin(jobs, eq(stageSchedule.jobId, jobs.id))
    .orderBy(asc(stageSchedule.scheduledFor))
    .all();
}

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
  prepNotes?: string | null,
): StageScheduleRecord {
  const record: StageScheduleRecord = {
    id: randomUUID(),
    jobId,
    stage,
    scheduledFor,
    prepNotes: prepNotes ?? null,
  };
  db.insert(stageSchedule)
    .values(record)
    .onConflictDoUpdate({
      target: [stageSchedule.jobId, stageSchedule.stage],
      // prepNotes only overwritten when the caller supplies it
      set: { scheduledFor, ...(prepNotes !== undefined ? { prepNotes } : {}) },
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
