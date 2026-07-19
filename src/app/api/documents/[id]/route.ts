import { z } from "zod";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { toDto } from "@/server/documents-dto";
import {
  deleteDocument,
  getDocument,
  updateDocument,
} from "@/server/documents";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.strictObject({
  name: z.string().trim().min(1).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
});

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const record = getDocument(getDb(), id);
  if (!record) return apiError(`Document ${id} not found`, 404);
  return apiOk(toDto(record));
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  const updated = updateDocument(getDb(), id, parsed.data);
  if (!updated) return apiError(`Document ${id} not found`, 404);
  return apiOk(toDto(updated));
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!deleteDocument(getDb(), id)) {
    return apiError(`Document ${id} not found`, 404);
  }
  return apiOk({ deleted: id });
}
