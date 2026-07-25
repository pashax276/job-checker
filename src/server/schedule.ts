import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, stageSchedule, type StageScheduleRecord } from "@/db/schema";
import type { Status } from "@/lib/constants";
import type { PrepQuestion } from "@/lib/prep-notes";

export interface ScheduleWithJob {
  jobId: string;
  company: string;
  role: string;
  stage: string;
  scheduledFor: string;
  prepNotes: string | null;
  questions: PrepQuestion[];
  outcome: string | null;
  status: string;
  postingUrl: string | null;
}

export function parseQuestions(raw: string | null): PrepQuestion[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // legacy rows predate askedBy — they were always "questions I plan to
    // ask", so that's the correct backfilled default.
    return (parsed as PrepQuestion[]).map((q) => ({
      ...q,
      askedBy: q.askedBy ?? "me",
    }));
  } catch {
    return [];
  }
}

/** Every booked step joined with its job — ICS calendar and the Prep page. */
export function listAllSchedules(db: DB): ScheduleWithJob[] {
  return db
    .select({
      jobId: stageSchedule.jobId,
      company: jobs.company,
      role: jobs.role,
      stage: stageSchedule.stage,
      scheduledFor: stageSchedule.scheduledFor,
      prepNotes: stageSchedule.prepNotes,
      questions: stageSchedule.questions,
      outcome: stageSchedule.outcome,
      status: jobs.status,
      postingUrl: jobs.postingUrl,
    })
    .from(stageSchedule)
    .innerJoin(jobs, eq(stageSchedule.jobId, jobs.id))
    .orderBy(asc(stageSchedule.scheduledFor))
    .all()
    .map((row) => ({ ...row, questions: parseQuestions(row.questions) }));
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
    outcome: null,
    questions: null,
  };
  db.insert(stageSchedule)
    .values(record)
    .onConflictDoUpdate({
      target: [stageSchedule.jobId, stageSchedule.stage],
      // prepNotes only overwritten when the caller supplies it; questions
      // is never touched here — rebooking a date must not wipe out
      // already-captured Q&A.
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

export type StageOutcome = "passed" | "failed" | null;

/** Mark how a held step went; null returns it to pending. */
export function setStageOutcome(
  db: DB,
  jobId: string,
  stage: Status,
  outcome: StageOutcome,
): boolean {
  return (
    db
      .update(stageSchedule)
      .set({ outcome })
      .where(and(eq(stageSchedule.jobId, jobId), eq(stageSchedule.stage, stage)))
      .run().changes > 0
  );
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

function getScheduleRow(
  db: DB,
  jobId: string,
  stage: Status,
): StageScheduleRecord | null {
  return (
    db
      .select()
      .from(stageSchedule)
      .where(and(eq(stageSchedule.jobId, jobId), eq(stageSchedule.stage, stage)))
      .get() ?? null
  );
}

function writeQuestions(
  db: DB,
  jobId: string,
  stage: Status,
  questions: PrepQuestion[],
): PrepQuestion[] {
  db.update(stageSchedule)
    .set({ questions: JSON.stringify(questions) })
    .where(and(eq(stageSchedule.jobId, jobId), eq(stageSchedule.stage, stage)))
    .run();
  return questions;
}

/**
 * Replace the whole question list — used to one-time-seed structured
 * questions from an AI-generated or pasted-in markdown brief.
 */
export function setQuestions(
  db: DB,
  jobId: string,
  stage: Status,
  questions: PrepQuestion[],
): PrepQuestion[] {
  if (!getScheduleRow(db, jobId, stage)) {
    throw new Error(`No booked ${stage} step for this job`);
  }
  return writeQuestions(db, jobId, stage, questions);
}

export function addQuestion(
  db: DB,
  jobId: string,
  stage: Status,
  text: string,
  askedBy: "me" | "interviewer" = "me",
): PrepQuestion[] {
  const row = getScheduleRow(db, jobId, stage);
  if (!row) throw new Error(`No booked ${stage} step for this job`);
  const question: PrepQuestion = {
    id: randomUUID(),
    text,
    response: null,
    askedBy,
  };
  return writeQuestions(db, jobId, stage, [
    ...parseQuestions(row.questions),
    question,
  ]);
}

export function updateQuestion(
  db: DB,
  jobId: string,
  stage: Status,
  questionId: string,
  patch: {
    text?: string;
    response?: string | null;
    askedBy?: "me" | "interviewer";
  },
): PrepQuestion[] {
  const row = getScheduleRow(db, jobId, stage);
  if (!row) throw new Error(`No booked ${stage} step for this job`);
  const questions = parseQuestions(row.questions);
  if (!questions.some((q) => q.id === questionId)) {
    throw new Error(`No question ${questionId} on this step`);
  }
  return writeQuestions(
    db,
    jobId,
    stage,
    questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
  );
}

export function removeQuestion(
  db: DB,
  jobId: string,
  stage: Status,
  questionId: string,
): PrepQuestion[] {
  const row = getScheduleRow(db, jobId, stage);
  if (!row) throw new Error(`No booked ${stage} step for this job`);
  return writeQuestions(
    db,
    jobId,
    stage,
    parseQuestions(row.questions).filter((q) => q.id !== questionId),
  );
}
