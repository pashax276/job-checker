import { z } from "zod";
import { DEFAULT_STATUS, DEFAULT_TIER, STATUSES, TIERS } from "@/lib/constants";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Trim strings; map undefined/empty-string to null. */
const toNull = (v: unknown): unknown => {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }
  return v;
};

const nullableText = () => z.preprocess(toNull, z.string().nullable());
const nullableIsoDate = () =>
  z.preprocess(
    toNull,
    z.string().regex(ISO_DATE_RE, "Expected YYYY-MM-DD").nullable(),
  );
const nullableUrl = () => z.preprocess(toNull, z.url().nullable());

export const jobCreateSchema = z.strictObject({
  id: z.string().min(1).optional(),
  company: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().min(1, "Role is required"),
  priorityTier: z.enum(TIERS).default(DEFAULT_TIER),
  status: z.enum(STATUSES).default(DEFAULT_STATUS),
  dateApplied: nullableIsoDate(),
  compNotes: nullableText(),
  nextAction: nullableText(),
  followUpDate: nullableIsoDate(),
  contact: nullableText(),
  notes: nullableText(),
  postingUrl: nullableUrl(),
});

// Patch semantics: absent key = leave unchanged, explicit null = clear.
// ZodOptional short-circuits on undefined, so preprocess only runs for present keys.
export const jobPatchSchema = z.strictObject({
  company: z.string().trim().min(1, "Company is required").optional(),
  role: z.string().trim().min(1, "Role is required").optional(),
  priorityTier: z.enum(TIERS).optional(),
  status: z.enum(STATUSES).optional(),
  dateApplied: nullableIsoDate().optional(),
  compNotes: nullableText().optional(),
  nextAction: nullableText().optional(),
  followUpDate: nullableIsoDate().optional(),
  contact: nullableText().optional(),
  notes: nullableText().optional(),
  postingUrl: nullableUrl().optional(),
});

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  tier: z.enum(TIERS).optional(),
  q: z.string().trim().min(1).optional(),
  dueOnly: z.preprocess((v) => v === true || v === "true", z.boolean()),
});

export type JobCreate = z.output<typeof jobCreateSchema>;
export type JobPatch = z.output<typeof jobPatchSchema>;
export type ListQuery = z.output<typeof listQuerySchema>;
