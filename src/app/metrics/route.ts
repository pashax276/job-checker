import { count, eq } from "drizzle-orm";
import client from "prom-client";
import { getDb } from "@/db/client";
import { documents, jobs, leads } from "@/db/schema";
import { STATUSES } from "@/lib/constants";
import { getStats } from "@/server/stats";

export const dynamic = "force-dynamic";

// One registry per process; route modules can re-evaluate in dev.
declare global {
  var __metricsRegistry:
    | {
        registry: client.Registry;
        jobsTotal: client.Gauge;
        jobsByStatus: client.Gauge<"status">;
        activeTotal: client.Gauge;
        leadsNew: client.Gauge;
        documentsTotal: client.Gauge;
        overdueFollowUps: client.Gauge;
      }
    | undefined;
}

function metrics() {
  if (!globalThis.__metricsRegistry) {
    const registry = new client.Registry();
    client.collectDefaultMetrics({ register: registry });
    globalThis.__metricsRegistry = {
      registry,
      jobsTotal: new client.Gauge({
        name: "jobtracker_jobs_total",
        help: "Total jobs tracked",
        registers: [registry],
      }),
      jobsByStatus: new client.Gauge({
        name: "jobtracker_jobs_by_status",
        help: "Jobs per pipeline status",
        labelNames: ["status"],
        registers: [registry],
      }),
      activeTotal: new client.Gauge({
        name: "jobtracker_active_total",
        help: "Active pipeline size",
        registers: [registry],
      }),
      leadsNew: new client.Gauge({
        name: "jobtracker_leads_new",
        help: "New discovery leads in the inbox",
        registers: [registry],
      }),
      documentsTotal: new client.Gauge({
        name: "jobtracker_documents_total",
        help: "Uploaded resumes and cover letters",
        registers: [registry],
      }),
      overdueFollowUps: new client.Gauge({
        name: "jobtracker_overdue_follow_ups",
        help: "Follow-ups past due",
        registers: [registry],
      }),
    };
  }
  return globalThis.__metricsRegistry;
}

// Gauges are refreshed on every scrape — cheap queries, always-current values.
export async function GET(): Promise<Response> {
  const m = metrics();
  const db = getDb();
  const stats = getStats(db);

  m.jobsTotal.set(
    db.select({ n: count() }).from(jobs).get()?.n ?? 0,
  );
  for (const status of STATUSES) {
    m.jobsByStatus.set({ status }, stats.statusCounts[status]);
  }
  m.activeTotal.set(stats.activeTotal);
  m.overdueFollowUps.set(stats.overdue.length);
  m.leadsNew.set(
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")).get()
      ?.n ?? 0,
  );
  m.documentsTotal.set(
    db.select({ n: count() }).from(documents).get()?.n ?? 0,
  );

  return new Response(await m.registry.metrics(), {
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
