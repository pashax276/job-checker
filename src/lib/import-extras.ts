import { z } from "zod";
import {
  SCHEDULABLE_STAGES,
  type EddStage,
  type SchedulableStage,
} from "@/lib/constants";
import type { PrepQuestion } from "@/lib/prep-notes";
import { eddReportSetSchema } from "@/lib/schemas";

/**
 * The JSON export carries far more per job than the 11 flat tracker columns
 * xlsx/csv share: booked prep steps, EDD reports, embedded resume/cover-letter
 * content, the JD snapshot, the skill match, and the structured comp split. Import maps
 * every format through the same column-keyed TrackerRow, so those fields have
 * nowhere to ride — restoring a backup used to silently drop all of them.
 *
 * This module parses them off a JSON entry and pins them to the row under a
 * key no column writer touches, so the commit step can put them back.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const EXTRAS_KEY = "__jobExtras";

export interface ImportedDocument {
  id: string;
  kind: "resume" | "cover-letter";
  name: string;
  fileName: string;
  mimeType: string;
  skills: string[];
  bullets: string[];
  experience: Array<{ company: string; title: string; period: string }>;
  extractedText: string;
}

export interface ImportedPrepStage {
  stage: SchedulableStage;
  scheduledFor: string;
  prepNotes: string | null;
  outcome: "passed" | "failed" | null;
  questions: PrepQuestion[];
}

export interface ImportedEddReport {
  stage: EddStage;
  reportedOn: string;
  /** Null in a hand-written backup; restore stamps it then. */
  createdAt: string | null;
}

export interface JobExtras {
  id: string | null;
  source: "manual" | "import" | "discovery" | null;
  compNotes: string | null;
  compBase: string | null;
  compBonus: string | null;
  compEquity: string | null;
  resumeVersion: string | null;
  skillMatch: string | null;
  jdSnapshot: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  resume: ImportedDocument | null;
  coverLetter: ImportedDocument | null;
  prep: ImportedPrepStage[];
  /** Prep entries that weren't booked steps — surfaced, never swallowed. */
  droppedPrep: number;
  eddReports: ImportedEddReport[];
  /** EDD entries with an unreportable stage or a bad date — also surfaced. */
  droppedEddReports: number;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  md: "text/markdown",
};

/** Older exports predate the mimeType field; the file name still tells us. */
export function inferMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" && v.trim() !== "" ? v : null));

const stringArray = z
  .unknown()
  .transform((v) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [],
  );

const documentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["resume", "cover-letter"]),
  name: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: nullableString.optional(),
  skills: stringArray,
  bullets: stringArray,
  experience: z
    .unknown()
    .transform((v) =>
      Array.isArray(v)
        ? (v as ImportedDocument["experience"]).filter(
            (e) => typeof e === "object" && e !== null,
          )
        : [],
    ),
  extractedText: z.string().catch(""),
});

const questionSchema = z.object({
  id: nullableString.optional(),
  text: z.string().min(1),
  response: nullableString.optional(),
  // Legacy rows predate askedBy — they were always "questions I plan to ask".
  askedBy: z.enum(["me", "interviewer"]).catch("me").optional(),
});

const prepStageSchema = z.object({
  stage: z.enum(SCHEDULABLE_STAGES),
  scheduledFor: z.string().regex(ISO_DATE_RE),
  prepNotes: nullableString.optional(),
  outcome: z.union([z.literal("passed"), z.literal("failed")]).nullish(),
  questions: z.unknown().optional(),
});

// Same stage and calendar-date rules the API enforces, minus its strictness
// about unknown keys — a backup may carry fields a newer version added.
const eddReportSchema = z.object({
  ...eddReportSetSchema.shape,
  // Only orders same-day timeline rows, so a value that isn't a timestamp
  // costs the report nothing — it is dropped and restore stamps a fresh one.
  createdAt: z.iso.datetime().nullish().catch(null),
});

function newQuestionId(index: number): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `restored-q-${index}`;
}

function parseQuestions(raw: unknown): PrepQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index) => {
    const parsed = questionSchema.safeParse(entry);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id ?? newQuestionId(index),
        text: parsed.data.text,
        response: parsed.data.response ?? null,
        askedBy: parsed.data.askedBy ?? "me",
      },
    ];
  });
}

function parseDocument(raw: unknown): ImportedDocument | null {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    mimeType: parsed.data.mimeType ?? inferMimeType(parsed.data.fileName),
  };
}

const jobExtrasSchema = z.object({
  id: nullableString.optional(),
  source: z.enum(["manual", "import", "discovery"]).nullish(),
  compNotes: nullableString.optional(),
  compBase: nullableString.optional(),
  compBonus: nullableString.optional(),
  compEquity: nullableString.optional(),
  resumeVersion: nullableString.optional(),
  skillMatch: nullableString.optional(),
  jdSnapshot: nullableString.optional(),
  createdAt: nullableString.optional(),
  updatedAt: nullableString.optional(),
});

function isJobEntry(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  // Flat tracker rows are header-keyed ("Company"/"Role"); JSON export entries
  // are field-keyed. Only the latter can carry extras.
  return typeof record.company === "string" || typeof record.role === "string";
}

/** Pull the rich, non-column fields off one JSON export entry. */
export function readJobExtras(entry: unknown): JobExtras | null {
  if (!isJobEntry(entry)) return null;
  const parsed = jobExtrasSchema.safeParse(entry);
  const base = parsed.success ? parsed.data : {};

  const rawPrep = Array.isArray(entry.prep) ? entry.prep : [];
  const prep: ImportedPrepStage[] = [];
  let droppedPrep = 0;
  for (const candidate of rawPrep) {
    const step = prepStageSchema.safeParse(candidate);
    if (!step.success) {
      // Hand-authored prep in the wild is often { title, type, summary } —
      // document descriptions, not stage_schedule rows. Nothing to restore,
      // but the count travels so the import can report it.
      droppedPrep += 1;
      continue;
    }
    prep.push({
      stage: step.data.stage,
      scheduledFor: step.data.scheduledFor,
      prepNotes: step.data.prepNotes ?? null,
      outcome: step.data.outcome ?? null,
      questions: parseQuestions(step.data.questions),
    });
  }

  // Absent on backups that predate the feature — that's "none", not an error.
  const rawEdd = Array.isArray(entry.eddReports) ? entry.eddReports : [];
  const eddReports: ImportedEddReport[] = [];
  let droppedEddReports = 0;
  for (const candidate of rawEdd) {
    const report = eddReportSchema.safeParse(candidate);
    if (!report.success) {
      droppedEddReports += 1;
      continue;
    }
    eddReports.push({
      stage: report.data.stage,
      reportedOn: report.data.reportedOn,
      createdAt: report.data.createdAt ?? null,
    });
  }

  return {
    id: base.id ?? null,
    source: base.source ?? null,
    compNotes: base.compNotes ?? null,
    compBase: base.compBase ?? null,
    compBonus: base.compBonus ?? null,
    compEquity: base.compEquity ?? null,
    resumeVersion: base.resumeVersion ?? null,
    skillMatch: base.skillMatch ?? null,
    jdSnapshot: base.jdSnapshot ?? null,
    createdAt: base.createdAt ?? null,
    updatedAt: base.updatedAt ?? null,
    resume: parseDocument(entry.resume),
    coverLetter: parseDocument(entry.coverLetter),
    prep,
    droppedPrep,
    eddReports,
    droppedEddReports,
  };
}

/**
 * Pin extras to a tracker row. Column-driven writers (xlsx/csv) and
 * trackerRowToJobInput both read named columns only, so the key is inert
 * everywhere except the commit step that looks for it.
 */
export function attachExtras(
  row: Record<string, unknown>,
  extras: JobExtras | null,
): Record<string, unknown> {
  return extras ? { ...row, [EXTRAS_KEY]: extras } : row;
}

/** Read back what attachExtras pinned; null for csv/xlsx rows. */
export function attachedExtras(
  row: Record<string, unknown>,
): JobExtras | null {
  const value = row[EXTRAS_KEY];
  return value ? (value as JobExtras) : null;
}
