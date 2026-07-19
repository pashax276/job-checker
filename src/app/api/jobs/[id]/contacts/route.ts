import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { contactCreateSchema } from "@/lib/schemas";
import { addContact } from "@/server/contacts";
import { getJob } from "@/server/jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getJob(getDb(), id)) return apiError(`Job ${id} not found`, 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(addContact(getDb(), id, parsed.data), 201);
}
