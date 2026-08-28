import type { DB } from "@/db/client";
import type { DocumentRecord } from "@/db/schema";
import type { ExperienceEntry } from "@/lib/resume-parse";
import type { Job } from "@/lib/types";
import type { DocumentKind } from "@/server/documents";
import { getDocument } from "@/server/documents";
import { listSchedule, parseQuestions } from "@/server/schedule";
import type { PrepQuestion } from "@/lib/prep-notes";

export interface ExportedDocument {
  id: string;
  kind: DocumentKind;
  name: string;
  fileName: string;
  mimeType: string;
  skills: string[];
  bullets: string[];
  experience: ExperienceEntry[];
  extractedText: string;
}

export interface ExportedPrepStage {
  stage: string;
  scheduledFor: string;
  prepNotes: string | null;
  outcome: string | null;
  questions: PrepQuestion[];
}

export interface ExportedJob extends Job {
  resume: ExportedDocument | null;
  coverLetter: ExportedDocument | null;
  prep: ExportedPrepStage[];
}

function toExportedDocument(record: DocumentRecord): ExportedDocument {
  return {
    id: record.id,
    kind: record.kind as DocumentKind,
    name: record.name,
    fileName: record.fileName,
    mimeType: record.mimeType,
    skills: JSON.parse(record.skills ?? "[]") as string[],
    bullets: JSON.parse(record.bullets ?? "[]") as string[],
    experience: JSON.parse(record.experience ?? "[]") as ExperienceEntry[],
    extractedText: record.extractedText,
  };
}

/**
 * A job as it should appear in a full JSON export/backup — unlike xlsx/csv
 * (the flat original tracker column layout), JSON embeds the referenced
 * resume/cover letter content and every booked stage's prep notes +
 * structured questions, since those live in separate tables the plain
 * spreadsheet export never touched.
 */
export function buildExportJob(db: DB, job: Job): ExportedJob {
  const resume = job.resumeId ? getDocument(db, job.resumeId) : null;
  const coverLetter = job.coverLetterId
    ? getDocument(db, job.coverLetterId)
    : null;
  const prep = listSchedule(db, job.id).map((row) => ({
    stage: row.stage,
    scheduledFor: row.scheduledFor,
    prepNotes: row.prepNotes,
    outcome: row.outcome,
    questions: parseQuestions(row.questions),
  }));
  return {
    ...job,
    resume: resume ? toExportedDocument(resume) : null,
    coverLetter: coverLetter ? toExportedDocument(coverLetter) : null,
    prep,
  };
}

export function buildExportJobs(db: DB, jobs: Job[]): ExportedJob[] {
  return jobs.map((job) => buildExportJob(db, job));
}
