import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/db/client";
import { documents, eddReports, jobs, stageSchedule } from "@/db/schema";
import type { ImportedDocument, JobExtras } from "@/lib/import-extras";

/** The handle drizzle hands a transaction callback — narrower than DB. */
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export interface RestoreCounts {
  documents: number;
  prepSteps: number;
  prepSkipped: number;
  eddReports: number;
  eddSkipped: number;
}

export const EMPTY_RESTORE: RestoreCounts = {
  documents: 0,
  prepSteps: 0,
  prepSkipped: 0,
  eddReports: 0,
  eddSkipped: 0,
};

export function addRestoreCounts(
  a: RestoreCounts,
  b: RestoreCounts,
): RestoreCounts {
  return {
    documents: a.documents + b.documents,
    prepSteps: a.prepSteps + b.prepSteps,
    prepSkipped: a.prepSkipped + b.prepSkipped,
    eddReports: a.eddReports + b.eddReports,
    eddSkipped: a.eddSkipped + b.eddSkipped,
  };
}

/**
 * Re-create an exported document row if it isn't already present. Many jobs
 * share one resume, so the same document arrives once per job — insert it once
 * and let the rest link to it.
 *
 * The original file bytes aren't in the export, only the extracted text, so a
 * restored document downloads as "Stored file is missing" until it's
 * re-uploaded. Its text, skills and bullets — everything the app reasons with
 * — come back intact.
 */
function restoreDocument(
  db: Tx,
  doc: ImportedDocument,
  createdAt: string,
): boolean {
  const existing = db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, doc.id))
    .get();
  if (existing) return false;

  db.insert(documents)
    .values({
      id: doc.id,
      kind: doc.kind,
      name: doc.name,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      extractedText: doc.extractedText,
      bullets: JSON.stringify(doc.bullets),
      skills: JSON.stringify(doc.skills),
      experience: JSON.stringify(doc.experience),
      createdAt,
    })
    .run();
  return true;
}

/**
 * Put back everything the flat tracker columns can't carry. Called after the
 * job row exists, so document inserts satisfy the resume_id foreign key.
 *
 * Fields are only overwritten when the backup actually has them — a sparse or
 * older backup must not blank out data the tracker already holds. Comp is the
 * one exception: export composes compBase/Bonus/Equity into the single
 * "Comp Notes" column, so the import step just wrote that composed string into
 * compNotes. Restoring all four verbatim is what un-composes it.
 */
export function applyJobExtras(
  db: DB,
  jobId: string,
  extras: JobExtras,
): RestoreCounts {
  return db.transaction((tx) => {
    const stamp = extras.createdAt ?? new Date().toISOString();
    let restoredDocuments = 0;
    if (extras.resume && restoreDocument(tx, extras.resume, stamp)) {
      restoredDocuments += 1;
    }
    if (extras.coverLetter && restoreDocument(tx, extras.coverLetter, stamp)) {
      restoredDocuments += 1;
    }

    const patch: Record<string, string | null> = {
      compNotes: extras.compNotes,
      compBase: extras.compBase,
      compBonus: extras.compBonus,
      compEquity: extras.compEquity,
    };
    const whenPresent = {
      resumeVersion: extras.resumeVersion,
      skillMatch: extras.skillMatch,
      jdSnapshot: extras.jdSnapshot,
      source: extras.source,
      createdAt: extras.createdAt,
      updatedAt: extras.updatedAt,
      resumeId: extras.resume?.id ?? null,
      coverLetterId: extras.coverLetter?.id ?? null,
    };
    for (const [key, value] of Object.entries(whenPresent)) {
      if (value !== null) patch[key] = value;
    }
    tx.update(jobs).set(patch).where(eq(jobs.id, jobId)).run();

    let prepSteps = 0;
    for (const step of extras.prep) {
      const questions =
        step.questions.length > 0 ? JSON.stringify(step.questions) : null;
      tx.insert(stageSchedule)
        .values({
          id: randomUUID(),
          jobId,
          stage: step.stage,
          scheduledFor: step.scheduledFor,
          prepNotes: step.prepNotes,
          outcome: step.outcome,
          questions,
        })
        // One date per stage per job — a rebooked step updates in place
        // rather than landing a second row.
        .onConflictDoUpdate({
          target: [stageSchedule.jobId, stageSchedule.stage],
          set: {
            scheduledFor: step.scheduledFor,
            prepNotes: step.prepNotes,
            outcome: step.outcome,
            questions,
          },
        })
        .run();
      prepSteps += 1;
    }

    let restoredEdd = 0;
    for (const report of extras.eddReports) {
      tx.insert(eddReports)
        .values({
          id: randomUUID(),
          jobId,
          stage: report.stage,
          reportedOn: report.reportedOn,
          createdAt: report.createdAt ?? new Date().toISOString(),
        })
        // One report per stage per job — the backup's date wins for a stage
        // that is already marked, the row is not doubled.
        .onConflictDoUpdate({
          target: [eddReports.jobId, eddReports.stage],
          set: { reportedOn: report.reportedOn },
        })
        .run();
      restoredEdd += 1;
    }

    return {
      documents: restoredDocuments,
      prepSteps,
      prepSkipped: extras.droppedPrep,
      eddReports: restoredEdd,
      eddSkipped: extras.droppedEddReports,
    };
  });
}

/** True when the id is free, so a restore can keep the job's original id. */
export function jobIdAvailable(db: DB, id: string): boolean {
  return !db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).get();
}

/** Booked steps for a job, used by tests and the restore report. */
export function countStageSchedule(db: DB, jobId: string, stage: string): number {
  return db
    .select({ id: stageSchedule.id })
    .from(stageSchedule)
    .where(and(eq(stageSchedule.jobId, jobId), eq(stageSchedule.stage, stage)))
    .all().length;
}
