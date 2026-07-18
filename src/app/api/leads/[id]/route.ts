import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { leadActionSchema } from "@/lib/discovery-schemas";
import { dismissLead, promoteLead } from "@/server/leads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = leadActionSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);

  try {
    if (parsed.data.action === "promote") {
      return apiOk(promoteLead(getDb(), id));
    }
    dismissLead(getDb(), id);
    return apiOk({ dismissed: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lead action failed";
    const status = /not found/i.test(message)
      ? 404
      : /duplicate|already/i.test(message)
        ? 409
        : 500;
    return apiError(message, status);
  }
}
