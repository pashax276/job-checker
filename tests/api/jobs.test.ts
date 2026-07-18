import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import * as jobsRoute from "@/app/api/jobs/route";
import * as jobRoute from "@/app/api/jobs/[id]/route";
import * as statsRoute from "@/app/api/stats/route";
import * as healthzRoute from "@/app/healthz/route";
import * as readyzRoute from "@/app/readyz/route";

type Envelope<T> = { success: boolean; data: T; error: string | null };

const post = (body: unknown) =>
  jobsRoute.POST(
    new Request("http://test/api/jobs", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );

const list = (qs = "") =>
  jobsRoute.GET(new Request(`http://test/api/jobs${qs}`));

const byId = (id: string) => ({ params: Promise.resolve({ id }) });

async function createOne(over: Record<string, unknown> = {}): Promise<string> {
  const res = await post({ company: "Acme", role: "Senior SRE", ...over });
  const body = (await res.json()) as Envelope<{ id: string }>;
  return body.data.id;
}

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  const raw = getDb().$client;
  raw.prepare("DELETE FROM status_history").run();
  raw.prepare("DELETE FROM leads").run();
  raw.prepare("DELETE FROM jobs").run();
});

describe("POST /api/jobs", () => {
  it("creates a job and returns 201 with the envelope", async () => {
    const res = await post({ company: "Acme", role: "Senior SRE" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Envelope<{ id: string; status: string }>;
    expect(body.success).toBe(true);
    expect(body.error).toBeNull();
    expect(body.data.status).toBe("Evaluating");
  });

  it("returns 400 with a helpful error for invalid input", async () => {
    const res = await post({ role: "No company" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Envelope<null>;
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/company/i);
  });
});

describe("GET /api/jobs", () => {
  it("lists jobs and honors filters", async () => {
    await createOne({ company: "A1", status: "Applied" });
    await createOne({ company: "A2", status: "Screen" });
    const all = (await (await list()).json()) as Envelope<unknown[]>;
    expect(all.data).toHaveLength(2);
    const applied = (await (
      await list("?status=Applied")
    ).json()) as Envelope<unknown[]>;
    expect(applied.data).toHaveLength(1);
  });

  it("rejects an invalid filter with 400", async () => {
    expect((await list("?status=Bogus")).status).toBe(400);
  });
});

describe("GET/PATCH/DELETE /api/jobs/:id", () => {
  it("returns the job with its status history", async () => {
    const id = await createOne();
    const res = await jobRoute.GET(new Request("http://test"), byId(id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      statusHistory: unknown[];
    }>;
    expect(body.data.statusHistory).toHaveLength(1);
  });

  it("404s for an unknown id", async () => {
    const res = await jobRoute.GET(new Request("http://test"), byId("nope"));
    expect(res.status).toBe(404);
  });

  it("PATCH with a status change appends history", async () => {
    const id = await createOne();
    const res = await jobRoute.PATCH(
      new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ status: "Applied" }),
        headers: { "content-type": "application/json" },
      }),
      byId(id),
    );
    expect(res.status).toBe(200);
    const detail = await jobRoute.GET(new Request("http://test"), byId(id));
    const body = (await detail.json()) as Envelope<{ statusHistory: unknown[] }>;
    expect(body.data.statusHistory).toHaveLength(2);
  });

  it("PATCH rejects invalid payloads with 400", async () => {
    const id = await createOne();
    const res = await jobRoute.PATCH(
      new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ status: "Ghosted" }),
        headers: { "content-type": "application/json" },
      }),
      byId(id),
    );
    expect(res.status).toBe(400);
  });

  it("DELETE removes the job; repeat delete 404s", async () => {
    const id = await createOne();
    expect(
      (
        await jobRoute.DELETE(
          new Request("http://test", { method: "DELETE" }),
          byId(id),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await jobRoute.DELETE(
          new Request("http://test", { method: "DELETE" }),
          byId(id),
        )
      ).status,
    ).toBe(404);
  });
});

describe("GET /api/stats", () => {
  it("aggregates counts, active total, and oldest-first overdue list", async () => {
    await createOne({ company: "Active1", status: "Applied", followUpDate: "2026-01-05" });
    await createOne({ company: "Active2", status: "Screen", followUpDate: "2026-01-02" });
    await createOne({ company: "Closed1", status: "Rejected", priorityTier: "Closed" });
    await createOne({ company: "Future", status: "Applied", followUpDate: "2099-01-01" });

    const res = await statsRoute.GET(new Request("http://test/api/stats"));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as Envelope<{
      statusCounts: Record<string, number>;
      activeTotal: number;
      overdue: Array<{ company: string }>;
      aging: Array<{ id: string; daysInCurrentStage: number }>;
      newLeads: number;
    }>;
    expect(data.statusCounts.Applied).toBe(2);
    expect(data.statusCounts.Offer).toBe(0);
    expect(data.activeTotal).toBe(3);
    expect(data.overdue.map((o) => o.company)).toEqual(["Active2", "Active1"]);
    expect(data.aging).toHaveLength(3);
    expect(data.newLeads).toBe(0);
  });
});

describe("health endpoints", () => {
  it("healthz always returns 200", async () => {
    expect((await healthzRoute.GET()).status).toBe(200);
  });

  it("readyz returns 200 once migrated", async () => {
    expect((await readyzRoute.GET()).status).toBe(200);
  });
});
