import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { watchlistPatchSchema } from "@/lib/discovery-schemas";
import { deleteWatchlistEntry, updateWatchlistEntry } from "@/server/watchlist";

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
  const parsed = watchlistPatchSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  const updated = updateWatchlistEntry(getDb(), id, parsed.data);
  if (!updated) return apiError(`Watchlist entry ${id} not found`, 404);
  return apiOk(updated);
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!deleteWatchlistEntry(getDb(), id)) {
    return apiError(`Watchlist entry ${id} not found`, 404);
  }
  return apiOk({ deleted: id });
}
