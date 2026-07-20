import Papa from "papaparse";
import { TRACKER_COLUMNS } from "@/lib/constants";
import type { Job } from "@/lib/types";
import { jobToTrackerRow, type TrackerRow } from "@/lib/xlsx";

/** Parse tracker-layout CSV text into header-keyed rows. */
export function parseCsv(text: string): TrackerRow[] {
  const result = Papa.parse<TrackerRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error at row ${first.row ?? "?"}: ${first.message}`);
  }
  return result.data;
}

/** Build tracker-layout CSV text in the original column order. */
export function buildTrackerCsv(jobs: Job[]): string {
  const rows = jobs.map((job) => {
    const record = jobToTrackerRow(job);
    return TRACKER_COLUMNS.map((col) => record[col] ?? "");
  });
  return Papa.unparse({ fields: [...TRACKER_COLUMNS], data: rows });
}
