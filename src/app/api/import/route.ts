import { z } from "zod";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { parseCsv } from "@/lib/csv";
import { buildImportPreview, type ImportPreviewRow } from "@/lib/import";
import { jobPatchSchema, listQuerySchema } from "@/lib/schemas";
import { parseTrackerWorkbook, type TrackerRow } from "@/lib/xlsx";
import { createJob, listJobs, updateJob } from "@/server/jobs";

export const dynamic = "force-dynamic";

const modeSchema = z.enum(["preview", "commit"]);
const decisionsSchema = z.record(
  z.string().regex(/^\d+$/),
  z.enum(["create", "skip", "update"]),
);

export interface ImportCommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}

async function rowsFromFile(file: File): Promise<TrackerRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return parseCsv(await file.text());
  }
  if (name.endsWith(".xlsx")) {
    const { rows } = await parseTrackerWorkbook(
      Buffer.from(await file.arrayBuffer()),
    );
    return rows;
  }
  throw new Error("Unsupported file type: upload .xlsx or .csv");
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("Missing file upload (field name: file)", 400);
  }
  const mode = modeSchema.safeParse(form.get("mode") ?? "preview");
  if (!mode.success) return apiZodError(mode.error);

  let decisions: Record<string, "create" | "skip" | "update"> = {};
  const rawDecisions = form.get("decisions");
  if (typeof rawDecisions === "string" && rawDecisions.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawDecisions);
    } catch {
      return apiError("decisions must be valid JSON", 400);
    }
    const parsed = decisionsSchema.safeParse(parsedJson);
    if (!parsed.success) return apiZodError(parsed.error);
    decisions = parsed.data;
  }

  let rows: TrackerRow[];
  try {
    rows = await rowsFromFile(file);
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Could not parse file", 400);
  }

  const db = getDb();
  const existing = listJobs(db, listQuerySchema.parse({}));
  const preview = buildImportPreview(rows, existing);

  if (mode.data === "preview") {
    return apiOk({ rows: preview });
  }

  const result = commitImport(preview, decisions);
  return apiOk(result);
}

function commitImport(
  preview: ImportPreviewRow[],
  decisions: Record<string, "create" | "skip" | "update">,
): ImportCommitResult {
  const db = getDb();
  const result: ImportCommitResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  for (const row of preview) {
    if (row.error !== null || row.input === null) {
      result.errors = [...result.errors, { index: row.index, error: row.error ?? "invalid row" }];
      continue;
    }
    const decision =
      decisions[String(row.index)] ??
      (row.duplicateOfId !== null ? "skip" : "create");
    if (decision === "skip") {
      result.skipped += 1;
      continue;
    }
    if (decision === "update" && row.duplicateOfId !== null) {
      const { id: _id, ...fields } = row.input;
      updateJob(db, row.duplicateOfId, jobPatchSchema.parse(fields));
      result.updated += 1;
      continue;
    }
    createJob(db, { ...row.input, id: undefined });
    result.created += 1;
  }
  return result;
}
