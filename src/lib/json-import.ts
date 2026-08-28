import { attachExtras, readJobExtras } from "@/lib/import-extras";
import { jobToTrackerRow, type TrackerRow } from "@/lib/xlsx";
import type { Job } from "@/lib/types";

/**
 * Accepts a JSON import: either a bare array (what GET /api/export?format=json
 * produces) or a { jobs: [...] } envelope (the seed file's shape). Each entry
 * maps through the same jobToTrackerRow() column mapping xlsx/csv export
 * uses, so downstream duplicate detection (company+role, case-insensitive)
 * behaves identically across all three import formats.
 *
 * JSON alone carries more than those columns — prep steps, embedded documents,
 * JD snapshot, skill match, structured comp. Those ride along pinned to the
 * row (see import-extras) so the commit step can restore them; every
 * column-driven consumer ignores them.
 */
export function parseJsonImport(text: string): TrackerRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : isJobsEnvelope(parsed)
      ? parsed.jobs
      : null;
  if (!list) {
    throw new Error(
      'Expected a JSON array of jobs, or an object with a "jobs" array',
    );
  }

  return list.map((entry) =>
    attachExtras(jobToTrackerRow(entry as Job), readJobExtras(entry)),
  );
}

function isJobsEnvelope(value: unknown): value is { jobs: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { jobs?: unknown }).jobs)
  );
}
