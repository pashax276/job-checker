import ExcelJS from "exceljs";
import { TRACKER_COLUMNS } from "@/lib/constants";
import type { Job } from "@/lib/types";

export type TrackerRow = Record<string, unknown>;

const FIELD_BY_COLUMN: Record<(typeof TRACKER_COLUMNS)[number], keyof Job> = {
  Company: "company",
  Role: "role",
  "Priority Tier": "priorityTier",
  Status: "status",
  "Date Applied": "dateApplied",
  "Comp Notes": "compNotes",
  "Next Action": "nextAction",
  "Follow-Up Date": "followUpDate",
  Contact: "contact",
  Notes: "notes",
  "Posting URL": "postingUrl",
};

/** Build an .xlsx workbook in the original tracker column order. */
export async function buildTrackerWorkbook(jobs: Job[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Jobs");
  sheet.addRow([...TRACKER_COLUMNS]);
  sheet.getRow(1).font = { bold: true };
  for (const job of jobs) {
    sheet.addRow(TRACKER_COLUMNS.map((col) => job[FIELD_BY_COLUMN[col]] ?? ""));
  }
  sheet.columns.forEach((col, i) => {
    col.width = i < 2 ? 28 : 16;
  });
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

/** Parse an .xlsx file into header-keyed rows (first sheet, first row = headers). */
export async function parseTrackerWorkbook(
  buffer: Buffer,
): Promise<{ headers: string[]; rows: TrackerRow[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? "").trim());
  });

  const rows: TrackerRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: TrackerRow = {};
    let hasValue = false;
    headers.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      const value = cellValue(cell.value);
      record[header] = value;
      if (value !== null && value !== "") hasValue = true;
    });
    if (hasValue) rows.push(record);
  });
  return { headers, rows };
}

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    // hyperlinks, rich text, formula results
    if ("text" in value && value.text !== undefined) {
      return typeof value.text === "string"
        ? value.text
        : (value.text as { richText: Array<{ text: string }> }).richText
            ?.map((r) => r.text)
            .join("");
    }
    if ("result" in value && value.result !== undefined) return value.result;
    if ("richText" in value) {
      return value.richText.map((r) => r.text).join("");
    }
    return null;
  }
  return value;
}
