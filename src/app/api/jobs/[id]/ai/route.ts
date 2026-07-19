import { z } from "zod";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { SCHEDULABLE_STAGES } from "@/lib/constants";
import {
  draftCoverLetter,
  draftFollowUp,
  generatePrepQuestions,
} from "@/server/ai";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("prep"), stage: z.enum(SCHEDULABLE_STAGES) }),
  z.strictObject({ kind: z.literal("follow-up") }),
  z.strictObject({ kind: z.literal("cover-letter") }),
]);

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);

  try {
    const db = getDb();
    const text =
      parsed.data.kind === "prep"
        ? await generatePrepQuestions(db, id, parsed.data.stage)
        : parsed.data.kind === "follow-up"
          ? await draftFollowUp(db, id)
          : await draftCoverLetter(db, id);
    return apiOk({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI request failed";
    const status = /not found/i.test(message)
      ? 404
      : /ANTHROPIC_API_KEY/.test(message)
        ? 400
        : 502;
    return apiError(message, status);
  }
}
