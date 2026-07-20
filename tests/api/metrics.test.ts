import { beforeAll, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import * as metricsRoute from "@/app/metrics/route";

beforeAll(() => {
  runMigrations();
  getDb();
});

describe("GET /metrics", () => {
  it("exposes Prometheus text with pipeline gauges", async () => {
    const res = await metricsRoute.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("jobtracker_jobs_total");
    expect(body).toContain("jobtracker_active_total");
    expect(body).toContain('jobtracker_jobs_by_status{status="Applied"}');
    expect(body).toContain("jobtracker_leads_new");
    expect(body).toContain("process_cpu_user_seconds_total");
  });
});
