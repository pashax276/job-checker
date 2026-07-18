import { toLocalIsoDate } from "@/lib/dates";
import { jobCreateSchema, type JobCreate } from "@/lib/schemas";
import type { TrackerRow } from "@/lib/xlsx";
import type { Job } from "@/lib/types";

/** Excel's 1900 date system epoch (serial 0 = 1899-12-30). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/** Normalize a spreadsheet cell into an ISO date string or null. */
export function coerceCellDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return toLocalIsoDate(value);
  if (typeof value === "number") {
    const d = new Date(EXCEL_EPOCH_MS + Math.round(value) * MS_PER_DAY);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`;
  }
  return String(value).trim() || null;
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Map a tracker-layout row (header-keyed) onto jobCreate input shape. */
export function trackerRowToJobInput(row: TrackerRow): Record<string, unknown> {
  return {
    company: cellText(row.Company) ?? "",
    role: cellText(row.Role) ?? "",
    priorityTier: cellText(row["Priority Tier"]) ?? undefined,
    status: cellText(row.Status) ?? undefined,
    dateApplied: coerceCellDate(row["Date Applied"]),
    compNotes: cellText(row["Comp Notes"]),
    nextAction: cellText(row["Next Action"]),
    followUpDate: coerceCellDate(row["Follow-Up Date"]),
    contact: cellText(row.Contact),
    notes: cellText(row.Notes),
    postingUrl: cellText(row["Posting URL"]),
  };
}

/** Case-insensitive, trimmed company+role identity used for dedupe. */
export function duplicateKey(company: string, role: string): string {
  return `${company.trim().toLowerCase()}|${role.trim().toLowerCase()}`;
}

export interface ImportPreviewRow {
  index: number;
  input: JobCreate | null;
  raw: Record<string, unknown>;
  duplicateOfId: string | null;
  error: string | null;
}

/** Validate rows and flag duplicates against the existing pipeline. */
export function buildImportPreview(
  rows: TrackerRow[],
  existing: Pick<Job, "id" | "company" | "role">[],
): ImportPreviewRow[] {
  const byKey = new Map(
    existing.map((j) => [duplicateKey(j.company, j.role), j.id]),
  );
  return rows.map((row, index) => {
    const mapped = trackerRowToJobInput(row);
    const parsed = jobCreateSchema.safeParse(mapped);
    if (!parsed.success) {
      return {
        index,
        input: null,
        raw: mapped,
        duplicateOfId: null,
        error: parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; "),
      };
    }
    return {
      index,
      input: parsed.data,
      raw: mapped,
      duplicateOfId:
        byKey.get(duplicateKey(parsed.data.company, parsed.data.role)) ?? null,
      error: null,
    };
  });
}
