import { getDb } from "@/db/client";
import {
  apiError,
  apiOk,
  apiZodError,
  withRouteErrors,
} from "@/lib/api-response";
import { eddReportClearSchema, eddReportSetSchema } from "@/lib/schemas";
import { clearEddReport, setEddReport } from "@/server/edd";
import { getJob } from "@/server/jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withRouteErrors(async function PUT(
  request: Request,
  ctx: Ctx,
): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = eddReportSetSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(setEddReport(getDb(), id, parsed.data));
});

export const DELETE = withRouteErrors(async function DELETE(
  request: Request,
  ctx: Ctx,
): Promise<Response> {
  const { id } = await ctx.params;
  const stage = new URL(request.url).searchParams.get("stage");
  const parsed = eddReportClearSchema.safeParse({ stage });
  if (!parsed.success) return apiZodError(parsed.error);
  if (!clearEddReport(getDb(), id, parsed.data.stage)) {
    return apiError(`${parsed.data.stage} was not reported to EDD`, 404);
  }
  return apiOk({ cleared: parsed.data.stage });
});
