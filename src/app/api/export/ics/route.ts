import { getDb } from "@/db/client";
import { buildFollowUpCalendar } from "@/lib/ics";
import { listQuerySchema } from "@/lib/schemas";
import type { Job } from "@/lib/types";
import { listJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const jobs = listJobs(getDb(), listQuerySchema.parse({})) as Job[];
  return new Response(buildFollowUpCalendar(jobs), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="follow-ups.ics"',
    },
  });
}
