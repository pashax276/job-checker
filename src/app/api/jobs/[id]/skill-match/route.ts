import { getDb } from "@/db/client";
import { apiError, apiOk } from "@/lib/api-response";
import { refreshSkillMatch } from "@/server/skill-match";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    return apiOk(await refreshSkillMatch(getDb(), id));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Skill match failed";
    const status = /not found/i.test(message)
      ? 404
      : /posting url|resume|http/i.test(message)
        ? 400
        : 502;
    return apiError(message, status);
  }
}
