import { getDb } from "@/db/client";
import { apiOk } from "@/lib/api-response";
import { listAllSchedules } from "@/server/schedule";

export const dynamic = "force-dynamic";

// All booked steps with job context — the Prep page's data source.
export async function GET(): Promise<Response> {
  return apiOk(listAllSchedules(getDb()));
}
