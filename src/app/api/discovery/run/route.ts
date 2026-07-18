import { getDb } from "@/db/client";
import { apiError, apiOk } from "@/lib/api-response";
import { runDiscovery } from "@/server/discovery/run";

export const dynamic = "force-dynamic";

/** Idempotent: dedupe makes repeat runs safe. Called by the UI "Run now"
 * button and by the Kubernetes CronJob. */
export async function POST(): Promise<Response> {
  try {
    return apiOk(await runDiscovery(getDb()));
  } catch (err: unknown) {
    return apiError(
      err instanceof Error ? err.message : "Discovery run failed",
      500,
    );
  }
}
