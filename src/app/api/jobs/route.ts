import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { jobCreateSchema, listQuerySchema } from "@/lib/schemas";
import { createJob, listJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(listJobs(getDb(), parsed.data));
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = jobCreateSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(createJob(getDb(), parsed.data), 201);
}
