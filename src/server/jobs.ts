import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull, like, lte, or, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  documents,
  jobs,
  statusHistory,
  type ActivityRecord,
  type ContactRecord,
  type JobRecord,
  type StageScheduleRecord,
  type StatusHistoryRecord,
} from "@/db/schema";
import { toLocalIsoDate } from "@/lib/dates";
import type { JobCreate, JobPatch, ListQuery } from "@/lib/schemas";
import { listActivity } from "@/server/activity";
import { listContacts } from "@/server/contacts";
import { listSchedule } from "@/server/schedule";

export type JobDetail = JobRecord & {
  statusHistory: StatusHistoryRecord[];
  contacts: ContactRecord[];
  activityLog: ActivityRecord[];
  schedule: StageScheduleRecord[];
};

export function createJob(db: DB, input: JobCreate, now = new Date()): JobRecord {
  const stamp = now.toISOString();
  const record: JobRecord = {
    id: input.id ?? randomUUID(),
    company: input.company,
    role: input.role,
    priorityTier: input.priorityTier,
    status: input.status,
    dateApplied: input.dateApplied,
    compNotes: input.compNotes,
    nextAction: input.nextAction,
    followUpDate: input.followUpDate,
    contact: input.contact,
    notes: input.notes,
    postingUrl: input.postingUrl,
    resumeVersion: input.resumeVersion,
    compBase: input.compBase,
    compBonus: input.compBonus,
    compEquity: input.compEquity,
    resumeId: input.resumeId,
    coverLetterId: input.coverLetterId,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.transaction((tx) => {
    tx.insert(jobs).values(record).run();
    tx.insert(statusHistory)
      .values({
        id: randomUUID(),
        jobId: record.id,
        fromStatus: null,
        toStatus: record.status,
        changedAt: stamp,
      })
      .run();
  });
  return record;
}

export function getJob(db: DB, id: string): JobDetail | null {
  const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
  if (!job) return null;
  const history = db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.jobId, id))
    .orderBy(asc(statusHistory.changedAt))
    .all();
  return {
    ...job,
    statusHistory: history,
    contacts: listContacts(db, id),
    activityLog: listActivity(db, id),
    schedule: listSchedule(db, id),
  };
}

export function updateJob(
  db: DB,
  id: string,
  patch: JobPatch,
  now = new Date(),
): JobRecord | null {
  const stamp = now.toISOString();
  return db.transaction((tx) => {
    const current = tx.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!current) return null;
    // Assigning a resume mirrors its version label into resumeVersion so the
    // table/export keep working without joins.
    let resumeVersionSync: { resumeVersion: string | null } | undefined;
    if (patch.resumeId !== undefined) {
      const doc = patch.resumeId
        ? tx
            .select({ name: documents.name })
            .from(documents)
            .where(eq(documents.id, patch.resumeId))
            .get()
        : null;
      resumeVersionSync = { resumeVersion: doc?.name ?? null };
    }
    const next = { ...current, ...patch, ...resumeVersionSync, updatedAt: stamp };
    tx.update(jobs).set(next).where(eq(jobs.id, id)).run();
    if (patch.status !== undefined && patch.status !== current.status) {
      tx.insert(statusHistory)
        .values({
          id: randomUUID(),
          jobId: id,
          fromStatus: current.status,
          toStatus: patch.status,
          changedAt: stamp,
        })
        .run();
    }
    return next;
  });
}

export function deleteJob(db: DB, id: string): boolean {
  const result = db.delete(jobs).where(eq(jobs.id, id)).run();
  return result.changes > 0;
}

export function listJobs(db: DB, query: ListQuery, today = new Date()): JobRecord[] {
  const conditions: SQL[] = [];
  if (query.status) conditions.push(eq(jobs.status, query.status));
  if (query.tier) conditions.push(eq(jobs.priorityTier, query.tier));
  if (query.dueOnly) {
    conditions.push(
      and(
        isNotNull(jobs.followUpDate),
        lte(jobs.followUpDate, toLocalIsoDate(today)),
      )!,
    );
  }
  if (query.q) {
    const needle = `%${query.q}%`;
    conditions.push(
      or(
        like(jobs.company, needle),
        like(jobs.role, needle),
        like(jobs.notes, needle),
        like(jobs.contact, needle),
      )!,
    );
  }
  return db
    .select()
    .from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(jobs.company), asc(jobs.role))
    .all();
}
