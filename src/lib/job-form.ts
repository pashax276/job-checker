import { DEFAULT_STATUS, DEFAULT_TIER, type Status, type Tier } from "@/lib/constants";
import { toLocalIsoDate } from "@/lib/dates";
import { jobCreateSchema, type JobCreate } from "@/lib/schemas";
import type { Job } from "@/lib/types";

/** String-only form state shared by the add dialog and the edit drawer. */
export interface JobFormValues {
  company: string;
  role: string;
  priorityTier: Tier;
  status: Status;
  dateApplied: string;
  followUpDate: string;
  compNotes: string;
  nextAction: string;
  contact: string;
  postingUrl: string;
  resumeVersion: string;
  compBase: string;
  compBonus: string;
  compEquity: string;
  resumeId: string;
  coverLetterId: string;
  notes: string;
}

export const EMPTY_JOB_FORM: JobFormValues = {
  company: "",
  role: "",
  priorityTier: DEFAULT_TIER,
  status: DEFAULT_STATUS,
  dateApplied: "",
  followUpDate: "",
  compNotes: "",
  nextAction: "",
  contact: "",
  postingUrl: "",
  resumeVersion: "",
  compBase: "",
  compBonus: "",
  compEquity: "",
  resumeId: "",
  coverLetterId: "",
  notes: "",
};

export function jobToFormValues(job: Job): JobFormValues {
  return {
    company: job.company,
    role: job.role,
    priorityTier: job.priorityTier,
    status: job.status,
    dateApplied: job.dateApplied ?? "",
    followUpDate: job.followUpDate ?? "",
    compNotes: job.compNotes ?? "",
    nextAction: job.nextAction ?? "",
    contact: job.contact ?? "",
    postingUrl: job.postingUrl ?? "",
    resumeVersion: job.resumeVersion ?? "",
    compBase: job.compBase ?? "",
    compBonus: job.compBonus ?? "",
    compEquity: job.compEquity ?? "",
    resumeId: job.resumeId ?? "",
    coverLetterId: job.coverLetterId ?? "",
    notes: job.notes ?? "",
  };
}

export type JobFormErrors = Partial<Record<keyof JobFormValues, string>>;

export interface JobFormValidation {
  data: JobCreate | null;
  errors: JobFormErrors;
}

/** Validate form values, mapping zod issues onto their field names. */
export function validateJobForm(values: JobFormValues): JobFormValidation {
  const parsed = jobCreateSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data, errors: {} };
  const errors: JobFormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof JobFormValues] = issue.message;
    }
  }
  return { data: null, errors };
}

/** Local date N days from `from`, as YYYY-MM-DD (for follow-up quick chips). */
export function addDaysIso(from: Date, days: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return toLocalIsoDate(d);
}

/** Best-effort display name from an ATS board slug ("ava-labs" -> "Ava Labs"). */
export function companyNameFromSlug(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
