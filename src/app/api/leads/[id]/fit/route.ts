import { getDb } from "@/db/client";
import { apiError, apiOk } from "@/lib/api-response";
import { assessLeadFit } from "@/server/ai";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    return apiOk({ text: await assessLeadFit(getDb(), id) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fit check failed";
    const status = /not found/i.test(message)
      ? 404
      : /ANTHROPIC_API_KEY/.test(message)
        ? 400
        : 502;
    return apiError(message, status);
  }
}
