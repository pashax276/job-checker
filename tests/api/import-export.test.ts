import os from "node:os";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import { jobCreateSchema, listQuerySchema } from "@/lib/schemas";
import { createDocument, getDocument } from "@/server/documents";
import { createJob, listJobs, updateJob } from "@/server/jobs";
import { addQuestion, listSchedule, upsertStageSchedule } from "@/server/schedule";
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

// The bug this guards: JSON export writes prep/documents/jdSnapshot/skillMatch,
// but import used to map through the 11 flat tracker columns only — so
// restoring a backup silently wiped every booked step, every prep note, every
// resume link and every JD snapshot.
describe("JSON export → import is a lossless backup round-trip", () => {
  const dir = `${os.tmpdir()}/import-restore-${process.pid}`;

  async function seedRichJob(): Promise<string> {
    const db = getDb();
    const id = createJob(
      db,
      jobCreateSchema.parse({
        company: "PostHog",
        role: "Site Reliability Engineer",
        status: "Screen",
        compBase: "246383-269724",
        compEquity: "equity",
        compNotes: "Formula-driven, no negotiation room",
      }),
    ).id;
    const resume = await createDocument(
      db,
      {
        kind: "resume",
        name: "Resume V2",
        fileName: "resume.txt",
        mimeType: "text/plain",
        data: Buffer.from("Senior Platform / DevOps Engineer. AWS, Kubernetes."),
      },
      dir,
    );
    updateJob(db, id, { resumeId: resume.id });
    db.$client
      .prepare("UPDATE jobs SET skill_match = ?, jd_snapshot = ? WHERE id = ?")
      .run(
        JSON.stringify({
          score: 0.75,
          matched: ["AWS"],
          missing: ["SQL"],
          checkedAt: "2026-08-23T07:03:21.417Z",
        }),
        "Site Reliability Engineer - PostHog. Karpenter, Cilium, ArgoCD.",
        id,
      );
    upsertStageSchedule(db, id, "Screen", "2026-08-27", "# Thursday\nThree beats.");
    addQuestion(db, id, "Screen", "How do you place level and step?");
    addQuestion(db, id, "Screen", "Walk me through your CV", "interviewer");
    return id;
  }

  async function exportJson(): Promise<string> {
    const res = await exportRoute.GET(
      new Request("http://test/api/export?format=json"),
    );
    return res.text();
  }

  async function importJson(
    json: string,
    decisions: Record<number, string> = {},
  ): Promise<Envelope<Record<string, number>>> {
    const form = new FormData();
    form.set("file", new File([json], "backup.json", { type: "application/json" }));
    form.set("mode", "commit");
    form.set("decisions", JSON.stringify(decisions));
    const res = await importRoute.POST(
      new Request("http://test/api/import", { method: "POST", body: form }),
    );
    return (await res.json()) as Envelope<Record<string, number>>;
  }

  beforeEach(() => {
    getDb().$client.prepare("DELETE FROM documents").run();
  });

  it("restores prep steps, notes and questions into a wiped database", async () => {
    await seedRichJob();
    const backup = await exportJson();

    const raw = getDb().$client;
    raw.prepare("DELETE FROM status_history").run();
    raw.prepare("DELETE FROM jobs").run();
    raw.prepare("DELETE FROM documents").run();
    expect(raw.prepare("SELECT COUNT(*) c FROM stage_schedule").get()).toMatchObject({ c: 0 });

    const body = await importJson(backup);
    expect(body.data.created).toBe(1);

    const restored = listJobs(getDb(), listQuerySchema.parse({}))[0];
    const steps = listSchedule(getDb(), restored.id);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      stage: "Screen",
      scheduledFor: "2026-08-27",
      prepNotes: "# Thursday\nThree beats.",
    });
    const questions = JSON.parse(steps[0].questions!) as Array<{
      text: string;
      askedBy: string;
    }>;
    expect(questions).toHaveLength(2);
    expect(questions[1].askedBy).toBe("interviewer");
  });

  it("restores the JD snapshot, skill match, comp fields and resume link", async () => {
    await seedRichJob();
    const backup = await exportJson();
    const raw = getDb().$client;
    raw.prepare("DELETE FROM status_history").run();
    raw.prepare("DELETE FROM jobs").run();
    raw.prepare("DELETE FROM documents").run();

    await importJson(backup);
    const restored = listJobs(getDb(), listQuerySchema.parse({}))[0];

    expect(restored.jdSnapshot).toContain("Karpenter");
    expect(restored.skillMatch).toContain('"score":0.75');
    expect(restored.compBase).toBe("246383-269724");
    expect(restored.compEquity).toBe("equity");
    expect(restored.compNotes).toBe("Formula-driven, no negotiation room");
    expect(restored.resumeId).not.toBeNull();

    const doc = getDocument(getDb(), restored.resumeId!)!;
    expect(doc.name).toBe("Resume V2");
    expect(doc.extractedText).toContain("Senior Platform");
    expect(JSON.parse(doc.skills!)).toContain("AWS");
  });

  it("enriches an existing job on the update path instead of duplicating it", async () => {
    await seedRichJob();
    const backup = await exportJson();

    // Simulate the lossy re-import that caused this: flat row only.
    const raw = getDb().$client;
    raw.prepare("DELETE FROM status_history").run();
    raw.prepare("DELETE FROM jobs").run();
    raw.prepare("DELETE FROM documents").run();
    const flat = createJob(
      getDb(),
      jobCreateSchema.parse({
        company: "PostHog",
        role: "Site Reliability Engineer",
      }),
    );
    expect(flat.jdSnapshot).toBeNull();

    const body = await importJson(backup, { 0: "update" });
    expect(body.data.updated).toBe(1);
    expect(listJobs(getDb(), listQuerySchema.parse({}))).toHaveLength(1);

    const healed = listJobs(getDb(), listQuerySchema.parse({}))[0];
    expect(healed.id).toBe(flat.id);
    expect(healed.jdSnapshot).toContain("Karpenter");
    expect(listSchedule(getDb(), flat.id)).toHaveLength(1);
  });

  it("reports what it restored so a silent data loss can't happen again", async () => {
    await seedRichJob();
    const backup = await exportJson();
    const raw = getDb().$client;
    raw.prepare("DELETE FROM status_history").run();
    raw.prepare("DELETE FROM jobs").run();
    raw.prepare("DELETE FROM documents").run();

    const body = await importJson(backup);
    expect(body.data.prepStepsRestored).toBe(1);
    expect(body.data.documentsRestored).toBe(1);
  });

  it("still imports a job whose prep entries aren't booked steps", async () => {
    // Hand-authored { title, type, summary } prep — can't be restored, must
    // not fail the row.
    const json = JSON.stringify([
      {
        company: "PostHog",
        role: "SRE",
        prep: [{ title: "PostHog_Thursday.md", type: "brief", summary: "..." }],
      },
    ]);
    const body = await importJson(json);
    expect(body.data.created).toBe(1);
    expect(body.data.prepSkipped).toBe(1);
  });

  it("leaves plain csv imports untouched by the restore path", async () => {
    const csv = [CSV_HEADER, "CsvCo,SRE,,,,,,,,,"].join("\n");
    const res = await importRoute.POST(importRequest(csv, "commit"));
    const body = (await res.json()) as Envelope<Record<string, number>>;
    expect(body.data.created).toBe(1);
    expect(body.data.prepStepsRestored).toBe(0);
    expect(body.data.documentsRestored).toBe(0);
  });
});
