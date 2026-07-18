import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { jobPatchSchema } from "@/lib/schemas";
import { deleteJob, getJob, updateJob } from "@/server/jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const job = getJob(getDb(), id);
  if (!job) return apiError(`Job ${id} not found`, 404);
  return apiOk(job);
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = jobPatchSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  const updated = updateJob(getDb(), id, parsed.data);
  if (!updated) return apiError(`Job ${id} not found`, 404);
  return apiOk(updated);
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!deleteJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  return apiOk({ deleted: id });
}
