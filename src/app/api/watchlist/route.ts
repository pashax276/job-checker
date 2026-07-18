import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { watchlistCreateSchema } from "@/lib/discovery-schemas";
import { createWatchlistEntry, listWatchlist } from "@/server/watchlist";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return apiOk(listWatchlist(getDb()));
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = watchlistCreateSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(createWatchlistEntry(getDb(), parsed.data), 201);
}
