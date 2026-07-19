import { getDb } from "@/db/client";
import { apiError, apiOk } from "@/lib/api-response";
import { reparseDocument } from "@/server/documents";
import { toDto } from "@/server/documents-dto";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Re-run extraction from the stored file (after parser fixes/upgrades).
export async function POST(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const record = await reparseDocument(getDb(), id);
    if (!record) return apiError(`Document ${id} not found`, 404);
    return apiOk(toDto(record));
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Re-parse failed",
      500,
    );
  }
}
