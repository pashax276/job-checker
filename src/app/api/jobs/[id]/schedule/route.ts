import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import {
  scheduleClearSchema,
  scheduleOutcomeSchema,
  scheduleSetSchema,
} from "@/lib/schemas";
import { getJob } from "@/server/jobs";
import {
  removeStageSchedule,
  setStageOutcome,
  upsertStageSchedule,
} from "@/server/schedule";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = scheduleSetSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(
    upsertStageSchedule(
      getDb(),
      id,
      parsed.data.stage,
      parsed.data.scheduledFor,
      parsed.data.prepNotes,
    ),
  );
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = scheduleOutcomeSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  if (!setStageOutcome(getDb(), id, parsed.data.stage, parsed.data.outcome)) {
    return apiError(`No booked ${parsed.data.stage} step for this job`, 404);
  }
  return apiOk({ stage: parsed.data.stage, outcome: parsed.data.outcome });
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const stage = new URL(request.url).searchParams.get("stage");
  const parsed = scheduleClearSchema.safeParse({ stage });
  if (!parsed.success) return apiZodError(parsed.error);
  if (!removeStageSchedule(getDb(), id, parsed.data.stage)) {
    return apiError(`No booked date for ${parsed.data.stage}`, 404);
  }
  return apiOk({ cleared: parsed.data.stage });
}
