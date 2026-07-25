import { getDb } from "@/db/client";
import { apiError } from "@/lib/api-response";
import { buildTrackerCsv } from "@/lib/csv";
import { listQuerySchema } from "@/lib/schemas";
import type { Job } from "@/lib/types";
import { buildTrackerWorkbook } from "@/lib/xlsx";
import { buildExportJobs } from "@/server/export";
import { listJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const format = new URL(request.url).searchParams.get("format") ?? "xlsx";
  const db = getDb();
  const jobs = listJobs(db, listQuerySchema.parse({})) as Job[];
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    // Unlike xlsx/csv (the flat original tracker columns), JSON is the
    // richest format — embed each job's resume/cover letter content and
    // booked-stage prep (notes + structured questions) so it round-trips
    // as a real backup, not just the spreadsheet columns.
    return new Response(JSON.stringify(buildExportJobs(db, jobs), null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="job-tracker-${stamp}.json"`,
      },
    });
  }
  if (format === "xlsx") {
    const buffer = await buildTrackerWorkbook(jobs);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="job-tracker-${stamp}.xlsx"`,
      },
    });
  }
  if (format === "csv") {
    return new Response(buildTrackerCsv(jobs), {
      headers: {
        "content-type": "text/csv",
        "content-disposition": `attachment; filename="job-tracker-${stamp}.csv"`,
      },
    });
  }
  return apiError(`Unknown export format "${format}" (use xlsx, csv, or json)`, 400);
}
