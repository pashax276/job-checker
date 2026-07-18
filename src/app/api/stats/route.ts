import { getDb } from "@/db/client";
import { apiOk } from "@/lib/api-response";
import { getStats } from "@/server/stats";

export const dynamic = "force-dynamic";

export async function GET(_request: Request): Promise<Response> {
  return apiOk(getStats(getDb()));
}
