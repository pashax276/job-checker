import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import { jobCreateSchema, listQuerySchema } from "@/lib/schemas";
import { createJob, listJobs } from "@/server/jobs";
import * as importRoute from "@/app/api/import/route";
import * as exportRoute from "@/app/api/export/route";
import * as icsRoute from "@/app/api/export/ics/route";

type Envelope<T> = { success: boolean; data: T; error: string | null };

const CSV_HEADER =
  "Company,Role,Priority Tier,Status,Date Applied,Comp Notes,Next Action,Follow-Up Date,Contact,Notes,Posting URL";

function importRequest(
  csv: string,
  mode: "preview" | "commit",
  decisions: Record<number, string> = {},
): Request {
  const form = new FormData();
  form.set("file", new File([csv], "tracker.csv", { type: "text/csv" }));
  form.set("mode", mode);
  form.set("decisions", JSON.stringify(decisions));
  return new Request("http://test/api/import", { method: "POST", body: form });
}

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  const raw = getDb().$client;
  raw.prepare("DELETE FROM status_history").run();
  raw.prepare("DELETE FROM jobs").run();
});

describe("POST /api/import", () => {
  it("preview flags duplicates on case-insensitive company+role", async () => {
    createJob(
      getDb(),
      jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
    );
    const csv = [
      CSV_HEADER,
      "ACME,senior sre,2 - High,Applied,,,,,,,",
      "NewCo,Platform Engineer,,,,,,,,,",
    ].join("\n");
    const res = await importRoute.POST(importRequest(csv, "preview"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      rows: Array<{ duplicateOfId: string | null; error: string | null }>;
    }>;
    expect(body.data.rows).toHaveLength(2);
    expect(body.data.rows[0].duplicateOfId).not.toBeNull();
    expect(body.data.rows[1].duplicateOfId).toBeNull();
  });

  it("commit honors per-row skip/update decisions", async () => {
    const existing = createJob(
      getDb(),
      jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
    );
    const csv = [
      CSV_HEADER,
      "Acme,Senior SRE,1 - Top,Screen,,,,,,updated notes,",
      "NewCo,Platform Engineer,,,,,,,,,",
    ].join("\n");
    const res = await importRoute.POST(
      importRequest(csv, "commit", { 0: "update" }),
    );
    const body = (await res.json()) as Envelope<{
      created: number;
      updated: number;
      skipped: number;
    }>;
    expect(body.data.created).toBe(1);
    expect(body.data.updated).toBe(1);
    const jobs = listJobs(getDb(), listQuerySchema.parse({}));
    expect(jobs).toHaveLength(2);
    const acme = jobs.find((j) => j.id === existing.id);
    expect(acme?.priorityTier).toBe("1 - Top");
    expect(acme?.status).toBe("Screen");
  });

  it("commit skips duplicates by default", async () => {
    createJob(
      getDb(),
      jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
    );
    const csv = [CSV_HEADER, "Acme,Senior SRE,,,,,,,,,"].join("\n");
    const res = await importRoute.POST(importRequest(csv, "commit"));
    const body = (await res.json()) as Envelope<{
      created: number;
      skipped: number;
    }>;
    expect(body.data.created).toBe(0);
    expect(body.data.skipped).toBe(1);
  });

  it("rejects a request without a file", async () => {
    const form = new FormData();
    form.set("mode", "preview");
    const res = await importRoute.POST(
      new Request("http://test/api/import", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a .json upload, using the same company+role dedupe as csv/xlsx", async () => {
    createJob(
      getDb(),
      jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
    );
    const json = JSON.stringify([
      { company: "ACME", role: "senior sre" },
      { company: "NewCo", role: "Platform Engineer" },
    ]);
    const form = new FormData();
    form.set("file", new File([json], "export.json", { type: "application/json" }));
    form.set("mode", "preview");
    const res = await importRoute.POST(
      new Request("http://test/api/import", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      rows: Array<{ duplicateOfId: string | null; error: string | null }>;
    }>;
    expect(body.data.rows).toHaveLength(2);
    expect(body.data.rows[0].duplicateOfId).not.toBeNull();
    expect(body.data.rows[1].duplicateOfId).toBeNull();
  });
});

describe("GET /api/export", () => {
  beforeEach(() => {
    createJob(
      getDb(),
      jobCreateSchema.parse({
        company: "Acme",
        role: "Senior SRE",
        followUpDate: "2099-01-01",
      }),
    );
  });

  it("returns JSON export enriched with resume/coverLetter/prep, defaulting to null/empty", async () => {
    const res = await exportRoute.GET(
      new Request("http://test/api/export?format=json"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(".json");
    const rows = (await res.json()) as Array<{
      company: string;
      resume: unknown;
      coverLetter: unknown;
      prep: unknown[];
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Acme");
    expect(rows[0].resume).toBeNull();
    expect(rows[0].coverLetter).toBeNull();
    expect(rows[0].prep).toEqual([]);
  });

  it("JSON export's extra resume/coverLetter/prep fields don't break re-import (jobToTrackerRow ignores unknown keys)", async () => {
    const exportRes = await exportRoute.GET(
      new Request("http://test/api/export?format=json"),
    );
    const exported = await exportRes.text();
    const form = new FormData();
    form.set("file", new File([exported], "export.json", { type: "application/json" }));
    form.set("mode", "preview");
    const res = await importRoute.POST(
      new Request("http://test/api/import", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<{
      rows: Array<{ duplicateOfId: string | null; error: string | null }>;
    }>;
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].error).toBeNull();
    expect(body.data.rows[0].duplicateOfId).not.toBeNull();
  });

  it("returns an xlsx attachment", async () => {
    const res = await exportRoute.GET(
      new Request("http://test/api/export?format=xlsx"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(500);
  });

  it("returns a csv attachment", async () => {
    const res = await exportRoute.GET(
      new Request("http://test/api/export?format=csv"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain(".csv");
    const text = await res.text();
    expect(text).toContain("Company");
    expect(text).toContain("Acme");
  });

  it("rejects unknown formats", async () => {
    const res = await exportRoute.GET(
      new Request("http://test/api/export?format=pdf"),
    );
    expect(res.status).toBe(400);
  });

  it("serves an ics calendar of upcoming follow-ups", async () => {
    const res = await icsRoute.GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("Acme");
  });
});
