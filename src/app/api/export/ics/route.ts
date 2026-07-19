import { getDb } from "@/db/client";
import { buildTrackerCalendar } from "@/lib/ics";
import { listQuerySchema } from "@/lib/schemas";
import type { Job } from "@/lib/types";
import { listJobs } from "@/server/jobs";
import { listAllSchedules } from "@/server/schedule";

export const dynamic = "force-dynamic";

// Subscribe-able calendar: booked interview steps + upcoming follow-ups.
export async function GET(): Promise<Response> {
  const db = getDb();
  const jobs = listJobs(db, listQuerySchema.parse({})) as Job[];
  return new Response(buildTrackerCalendar(jobs, listAllSchedules(db)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="job-pipeline.ics"',
    },
  });
}
