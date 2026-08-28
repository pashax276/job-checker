import { z } from "zod";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { parseCsv } from "@/lib/csv";
import { buildImportPreview, type ImportPreviewRow } from "@/lib/import";
import { parseJsonImport } from "@/lib/json-import";
import { jobPatchSchema, listQuerySchema } from "@/lib/schemas";
import { parseTrackerWorkbook, type TrackerRow } from "@/lib/xlsx";
import { createJob, listJobs, updateJob } from "@/server/jobs";
import {
  addRestoreCounts,
  applyJobExtras,
  EMPTY_RESTORE,
  jobIdAvailable,
  type RestoreCounts,
} from "@/server/restore";

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
  /** JSON backups carry more than the flat columns — what came back. */
  documentsRestored: number;
  prepStepsRestored: number;
  /** Prep entries that weren't booked steps, so couldn't be restored. */
  prepSkipped: number;
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
  if (name.endsWith(".json")) {
    return parseJsonImport(await file.text());
  }
  throw new Error("Unsupported file type: upload .xlsx, .csv, or .json");
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
    // Extras hold full JD snapshots and resume text — megabytes across a real
    // backup, and the browser never needs them. Commit re-reads the file.
    return apiOk({
      rows: preview.map(({ extras: _extras, ...row }) => row),
    });
  }

  const result = commitImport(preview, decisions);
  return apiOk(result);
}

function commitImport(
  preview: ImportPreviewRow[],
  decisions: Record<string, "create" | "skip" | "update">,
): ImportCommitResult {
  const db = getDb();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors: Array<{ index: number; error: string }> = [];
  let restored: RestoreCounts = EMPTY_RESTORE;

  for (const row of preview) {
    if (row.error !== null || row.input === null) {
      errors = [...errors, { index: row.index, error: row.error ?? "invalid row" }];
      continue;
    }
    const decision =
      decisions[String(row.index)] ??
      (row.duplicateOfId !== null ? "skip" : "create");
    if (decision === "skip") {
      skipped += 1;
      continue;
    }

    let jobId: string;
    if (decision === "update" && row.duplicateOfId !== null) {
      const { id: _id, ...fields } = row.input;
      updateJob(db, row.duplicateOfId, jobPatchSchema.parse(fields));
      jobId = row.duplicateOfId;
      updated += 1;
    } else {
      // Restoring a backup into an empty tracker keeps the original ids, so a
      // repeat restore updates rather than duplicating.
      const keepId =
        row.extras?.id && jobIdAvailable(db, row.extras.id)
          ? row.extras.id
          : undefined;
      jobId = createJob(db, { ...row.input, id: keepId }, new Date(), "import").id;
      created += 1;
    }

    if (row.extras) {
      restored = addRestoreCounts(restored, applyJobExtras(db, jobId, row.extras));
    }
  }

  return {
    created,
    updated,
    skipped,
    errors,
    documentsRestored: restored.documents,
    prepStepsRestored: restored.prepSteps,
    prepSkipped: restored.prepSkipped,
  };
}
