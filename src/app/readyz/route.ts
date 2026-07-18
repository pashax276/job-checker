import { isDbReady } from "@/db/client";

export const dynamic = "force-dynamic";

// Readiness: DB open and migrations applied.
export async function GET(): Promise<Response> {
  if (!isDbReady()) {
    return Response.json(
      { status: "unavailable", reason: "database not ready" },
      { status: 503 },
    );
  }
  return Response.json({ status: "ok" });
}
