import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { contactPatchSchema } from "@/lib/schemas";
import { deleteContact, updateContact } from "@/server/contacts";

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
  const parsed = contactPatchSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  const updated = updateContact(getDb(), id, parsed.data);
  if (!updated) return apiError(`Contact ${id} not found`, 404);
  return apiOk(updated);
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!deleteContact(getDb(), id)) return apiError(`Contact ${id} not found`, 404);
  return apiOk({ deleted: id });
}
