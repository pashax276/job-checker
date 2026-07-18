import Papa from "papaparse";
import type { TrackerRow } from "@/lib/xlsx";

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
