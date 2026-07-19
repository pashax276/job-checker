import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import {
  DEFAULT_ALERT_QUERIES,
  settingsPutSchema,
  type AlertQuery,
} from "@/lib/discovery-schemas";
import type { DiscoveryResult } from "@/server/discovery/run";
import { getSetting, setSetting } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const db = getDb();
  return apiOk({
    rssFeeds: getSetting<string[]>(db, "rssFeeds") ?? [],
    profileBlurb: getSetting<string>(db, "profileBlurb") ?? "",
    alertQueries:
      getSetting<AlertQuery[]>(db, "alertQueries") ?? DEFAULT_ALERT_QUERIES,
    lastDiscoveryRun: getSetting<DiscoveryResult>(db, "lastDiscoveryRun"),
  });
}

export async function PUT(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = settingsPutSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  const db = getDb();
  if (parsed.data.rssFeeds !== undefined) {
    setSetting(db, "rssFeeds", parsed.data.rssFeeds);
  }
  if (parsed.data.profileBlurb !== undefined) {
    setSetting(db, "profileBlurb", parsed.data.profileBlurb);
  }
  if (parsed.data.alertQueries !== undefined) {
    setSetting(db, "alertQueries", parsed.data.alertQueries);
  }
  return apiOk({ saved: true });
}
