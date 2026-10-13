import { getDb } from "@/db/client";
import {
  apiError,
  apiOk,
  apiZodError,
  withRouteErrors,
} from "@/lib/api-response";
import { jobCreateSchema, listQuerySchema } from "@/lib/schemas";
import { listEddStagesByJob } from "@/server/edd";
import { createJob, listJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";

export const GET = withRouteErrors(async function GET(
  request: Request,
): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) return apiZodError(parsed.error);
  const db = getDb();
  // Reported stages ride on the list rows so the board and table can badge
  // a job without fetching each detail. Added here, not in listJobs, so the
  // export and import paths that share it keep the plain row shape.
  const eddStages = listEddStagesByJob(db);
  return apiOk(
    listJobs(db, parsed.data).map((job) => ({
      ...job,
      eddStages: eddStages.get(job.id) ?? [],
    })),
  );
});

export const POST = withRouteErrors(async function POST(
  request: Request,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = jobCreateSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(createJob(getDb(), parsed.data), 201);
});
