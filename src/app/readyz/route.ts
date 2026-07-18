import { isDbReady } from "@/db/client";

export const dynamic = "force-dynamic";

// Readiness: DB open and migrations applied.
export async function GET(): Promise<Response> {
  if (!isDbReady()) {
    return Response.json({ ok: false, reason: "database not ready" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
