import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import * as jobsRoute from "@/app/api/jobs/route";
import * as jobRoute from "@/app/api/jobs/[id]/route";
import * as eddRoute from "@/app/api/jobs/[id]/edd/route";

type Envelope<T> = { success: boolean; data: T; error: string | null };
type Report = { id: string; stage: string; reportedOn: string };

const byId = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  });
}

async function createOne(company = "Acme"): Promise<string> {
  const res = await jobsRoute.POST(
    jsonRequest("POST", "http://test/api/jobs", { company, role: "Senior SRE" }),
  );
  return ((await res.json()) as Envelope<{ id: string }>).data.id;
}

const put = (jobId: string, body: unknown) =>
  eddRoute.PUT(
    jsonRequest("PUT", "http://test/api/jobs/x/edd", body),
    byId(jobId),
  );

const del = (jobId: string, stage: string) =>
  eddRoute.DELETE(
    jsonRequest(
      "DELETE",
      `http://test/api/jobs/x/edd?stage=${encodeURIComponent(stage)}`,
    ),
    byId(jobId),
  );

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  const raw = getDb().$client;
  raw.prepare("DELETE FROM status_history").run();
  raw.prepare("DELETE FROM edd_reports").run();
  raw.prepare("DELETE FROM jobs").run();
});

describe("PUT /api/jobs/:id/edd", () => {
  it("marks a stage reported and the job detail shows it", async () => {
    const jobId = await createOne();
    const res = await put(jobId, { stage: "Applied", reportedOn: "2026-10-05" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<Report>;
    expect(body.data).toMatchObject({
      stage: "Applied",
      reportedOn: "2026-10-05",
    });

    const detail = (await (
      await jobRoute.GET(jsonRequest("GET", "http://test/api/jobs/x"), byId(jobId))
    ).json()) as Envelope<{ eddReports: Report[] }>;
    expect(detail.data.eddReports.map((r) => r.stage)).toEqual(["Applied"]);
  });

  it("re-marking a stage moves its date rather than adding a report", async () => {
    const jobId = await createOne();
    await put(jobId, { stage: "Screen", reportedOn: "2026-10-12" });
    const res = await put(jobId, { stage: "Screen", reportedOn: "2026-10-14" });
    expect(res.status).toBe(200);

    const detail = (await (
      await jobRoute.GET(jsonRequest("GET", "http://test/api/jobs/x"), byId(jobId))
    ).json()) as Envelope<{ eddReports: Report[] }>;
    expect(detail.data.eddReports).toHaveLength(1);
    expect(detail.data.eddReports[0].reportedOn).toBe("2026-10-14");
  });

  it("404s for a job that does not exist", async () => {
    const res = await put("nope", { stage: "Applied", reportedOn: "2026-10-05" });
    expect(res.status).toBe(404);
  });

  it.each([
    ["a stage that is not a work-search contact", { stage: "Evaluating", reportedOn: "2026-10-05" }],
    ["a date that is not YYYY-MM-DD", { stage: "Applied", reportedOn: "10/05/2026" }],
    ["a day that does not exist", { stage: "Applied", reportedOn: "2026-02-30" }],
    ["a missing date", { stage: "Applied" }],
  ])("400s for %s", async (_label, body) => {
    const jobId = await createOne();
    const res = await put(jobId, body);
    expect(res.status).toBe(400);
    const envelope = (await res.json()) as Envelope<null>;
    expect(envelope.success).toBe(false);
    expect(envelope.error).toBeTruthy();
  });

  it("400s for a body that is not JSON", async () => {
    const jobId = await createOne();
    const res = await eddRoute.PUT(
      new Request("http://test/api/jobs/x/edd", { method: "PUT", body: "{nope" }),
      byId(jobId),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/jobs/:id/edd", () => {
  it("clears a reported stage, then 404s because nothing is left to clear", async () => {
    const jobId = await createOne();
    await put(jobId, { stage: "Applied", reportedOn: "2026-10-05" });

    const first = await del(jobId, "Applied");
    expect(first.status).toBe(200);
    expect(((await first.json()) as Envelope<{ cleared: string }>).data).toEqual({
      cleared: "Applied",
    });

    expect((await del(jobId, "Applied")).status).toBe(404);
  });

  it("400s for a stage that cannot be reported", async () => {
    const jobId = await createOne();
    expect((await del(jobId, "Rejected")).status).toBe(400);
  });

  it("400s when the stage is missing", async () => {
    const jobId = await createOne();
    const res = await eddRoute.DELETE(
      jsonRequest("DELETE", "http://test/api/jobs/x/edd"),
      byId(jobId),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/jobs", () => {
  it("lists each job's reported stages, empty when none", async () => {
    const reported = await createOne("Acme");
    const untouched = await createOne("Beta");
    await put(reported, { stage: "Applied", reportedOn: "2026-10-05" });
    await put(reported, { stage: "Screen", reportedOn: "2026-10-12" });

    const res = await jobsRoute.GET(jsonRequest("GET", "http://test/api/jobs"));
    const rows = ((await res.json()) as Envelope<
      Array<{ id: string; eddStages: string[] }>
    >).data;
    expect(rows.find((r) => r.id === reported)?.eddStages).toEqual([
      "Applied",
      "Screen",
    ]);
    expect(rows.find((r) => r.id === untouched)?.eddStages).toEqual([]);
  });
});
