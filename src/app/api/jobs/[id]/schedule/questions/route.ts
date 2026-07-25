import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import {
  questionAddSchema,
  questionRemoveSchema,
  questionsImportSchema,
  questionUpdateSchema,
} from "@/lib/schemas";
import { getJob } from "@/server/jobs";
import {
  addQuestion,
  removeQuestion,
  setQuestions,
  updateQuestion,
} from "@/server/schedule";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  const body = await parseJson(request);
  if (body === undefined) return apiError("Request body must be valid JSON", 400);
  const parsed = questionAddSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  try {
    return apiOk(
      addQuestion(
        getDb(),
        id,
        parsed.data.stage,
        parsed.data.text,
        parsed.data.askedBy,
      ),
    );
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Add failed", 404);
  }
}

/** Bulk-replace the question list — imports numbered items parsed from an
 * AI-generated or pasted-in markdown brief. */
export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  const body = await parseJson(request);
  if (body === undefined) return apiError("Request body must be valid JSON", 400);
  const parsed = questionsImportSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  try {
    return apiOk(
      setQuestions(
        getDb(),
        id,
        parsed.data.stage,
        parsed.data.texts.map((text) => ({
          id: randomUUID(),
          text,
          response: null,
          askedBy: "me" as const,
        })),
      ),
    );
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Import failed", 404);
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  const body = await parseJson(request);
  if (body === undefined) return apiError("Request body must be valid JSON", 400);
  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  const { stage, questionId, ...patch } = parsed.data;
  try {
    return apiOk(updateQuestion(getDb(), id, stage, questionId, patch));
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Update failed", 404);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  const params = new URL(request.url).searchParams;
  const parsed = questionRemoveSchema.safeParse({
    stage: params.get("stage"),
    questionId: params.get("questionId"),
  });
  if (!parsed.success) return apiZodError(parsed.error);
  try {
    return apiOk(
      removeQuestion(getDb(), id, parsed.data.stage, parsed.data.questionId),
    );
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : "Remove failed", 404);
  }
}
