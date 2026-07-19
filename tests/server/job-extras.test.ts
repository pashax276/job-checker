import fs from "node:fs";
import os from "node:os";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { activityCreateSchema, contactCreateSchema } from "@/lib/schemas";
import { jobCreateSchema } from "@/lib/schemas";
import { addActivity, deleteActivity, listActivity } from "@/server/activity";
import {
  addContact,
  deleteContact,
  listContacts,
  updateContact,
} from "@/server/contacts";
import { createJob, deleteJob, getJob } from "@/server/jobs";

let db: DB;
let jobId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  jobId = createJob(
    db,
    jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
  ).id;
});

describe("contacts", () => {
  it("adds and lists contacts for a job", () => {
    addContact(
      db,
      jobId,
      contactCreateSchema.parse({
        name: "Maria G",
        role: "Recruiter",
        email: "maria@acme.example",
      }),
    );
    const contacts = listContacts(db, jobId);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      name: "Maria G",
      role: "Recruiter",
      email: "maria@acme.example",
      lastTouch: null,
    });
  });

  it("rejects a contact with an invalid email", () => {
    expect(() =>
      contactCreateSchema.parse({ name: "X", email: "not-an-email" }),
    ).toThrow();
  });

  it("updates lastTouch", () => {
    const contact = addContact(
      db,
      jobId,
      contactCreateSchema.parse({ name: "Maria G" }),
    );
    const updated = updateContact(db, contact.id, { lastTouch: "2026-07-18" });
    expect(updated?.lastTouch).toBe("2026-07-18");
  });

  it("deletes a contact and cascades with the job", () => {
    const contact = addContact(
      db,
      jobId,
      contactCreateSchema.parse({ name: "Maria G" }),
    );
    expect(deleteContact(db, contact.id)).toBe(true);
    addContact(db, jobId, contactCreateSchema.parse({ name: "Second" }));
    deleteJob(db, jobId);
    const rows = db.$client
      .prepare("SELECT COUNT(*) AS n FROM contacts")
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it("getJob includes contacts and activity", () => {
    addContact(db, jobId, contactCreateSchema.parse({ name: "Maria G" }));
    addActivity(
      db,
      jobId,
      activityCreateSchema.parse({ note: "Phone screen went well" }),
    );
    const detail = getJob(db, jobId);
    expect(detail?.contacts).toHaveLength(1);
    expect(detail?.activityLog).toHaveLength(1);
  });
});

describe("stage schedule", () => {
  it("books a date for a stage and upserts on re-book", async () => {
    const { upsertStageSchedule } = await import("@/server/schedule");
    upsertStageSchedule(db, jobId, "Screen", "2026-07-22");
    upsertStageSchedule(db, jobId, "Panel", "2026-07-30");
    upsertStageSchedule(db, jobId, "Screen", "2026-07-24"); // rescheduled
    const detail = getJob(db, jobId);
    expect(detail?.schedule).toHaveLength(2);
    const screen = detail?.schedule.find((s) => s.stage === "Screen");
    expect(screen?.scheduledFor).toBe("2026-07-24");
  });

  it("removes a booked stage", async () => {
    const { removeStageSchedule, upsertStageSchedule } = await import(
      "@/server/schedule"
    );
    upsertStageSchedule(db, jobId, "Screen", "2026-07-22");
    expect(removeStageSchedule(db, jobId, "Screen")).toBe(true);
    expect(removeStageSchedule(db, jobId, "Screen")).toBe(false);
    expect(getJob(db, jobId)?.schedule).toHaveLength(0);
  });

  it("cascades with the job", async () => {
    const { upsertStageSchedule } = await import("@/server/schedule");
    upsertStageSchedule(db, jobId, "Panel", "2026-07-30");
    deleteJob(db, jobId);
    const rows = db.$client
      .prepare("SELECT COUNT(*) AS n FROM stage_schedule")
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });
});

describe("documents", () => {
  const tmpDir = () => {
    const dir = `${os.tmpdir()}/docs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  it("stores the file, extracts bullets and skills, and lists by kind", async () => {
    const { createDocument, listDocuments } = await import("@/server/documents");
    const dir = tmpDir();
    const doc = await createDocument(
      db,
      {
        kind: "resume",
        name: "v3-platform",
        fileName: "resume.txt",
        mimeType: "text/plain",
        data: Buffer.from("• Built EKS platform on AWS\n• Terraform everywhere"),
      },
      dir,
    );
    expect(doc.name).toBe("v3-platform");
    expect(JSON.parse(doc.bullets ?? "[]")).toHaveLength(2);
    expect(JSON.parse(doc.skills ?? "[]")).toContain("AWS");
    expect(fs.existsSync(`${dir}/${doc.id}`)).toBe(true);
    expect(listDocuments(db, "resume")).toHaveLength(1);
    expect(listDocuments(db, "cover-letter")).toHaveLength(0);
  });

  it("updates name and skills, deletes row and file", async () => {
    const { createDocument, deleteDocument, updateDocument, listDocuments } =
      await import("@/server/documents");
    const dir = tmpDir();
    const doc = await createDocument(
      db,
      {
        kind: "resume",
        name: "v1",
        fileName: "r.txt",
        mimeType: "text/plain",
        data: Buffer.from("plain"),
      },
      dir,
    );
    const updated = updateDocument(db, doc.id, {
      name: "v2",
      skills: ["AWS", "Kubernetes"],
    });
    expect(updated?.name).toBe("v2");
    expect(JSON.parse(updated?.skills ?? "[]")).toEqual(["AWS", "Kubernetes"]);
    expect(deleteDocument(db, doc.id, dir)).toBe(true);
    expect(fs.existsSync(`${dir}/${doc.id}`)).toBe(false);
    expect(listDocuments(db)).toHaveLength(0);
  });

  it("assigning a resume to a job mirrors its name into resumeVersion", async () => {
    const { createDocument } = await import("@/server/documents");
    const { updateJob } = await import("@/server/jobs");
    const { jobPatchSchema } = await import("@/lib/schemas");
    const dir = tmpDir();
    const doc = await createDocument(
      db,
      {
        kind: "resume",
        name: "v3-platform",
        fileName: "r.txt",
        mimeType: "text/plain",
        data: Buffer.from("x"),
      },
      dir,
    );
    const updated = updateJob(db, jobId, jobPatchSchema.parse({ resumeId: doc.id }));
    expect(updated?.resumeId).toBe(doc.id);
    expect(updated?.resumeVersion).toBe("v3-platform");
    const cleared = updateJob(db, jobId, jobPatchSchema.parse({ resumeId: null }));
    expect(cleared?.resumeVersion).toBeNull();
  });
});

describe("listAllSchedules", () => {
  it("joins job context and carries prep notes for the Prep page", async () => {
    const { listAllSchedules, upsertStageSchedule } = await import(
      "@/server/schedule"
    );
    upsertStageSchedule(db, jobId, "Screen", "2026-07-22", "Ask about on-call");
    const rows = listAllSchedules(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      jobId,
      company: "Acme",
      role: "Senior SRE",
      stage: "Screen",
      scheduledFor: "2026-07-22",
      prepNotes: "Ask about on-call",
      status: "Evaluating",
    });
  });
});

describe("stage outcomes", () => {
  it("records passed/failed on a booked step and clears back to pending", async () => {
    const { listAllSchedules, setStageOutcome, upsertStageSchedule } =
      await import("@/server/schedule");
    upsertStageSchedule(db, jobId, "Screen", "2026-07-10");
    expect(setStageOutcome(db, jobId, "Screen", "passed")).toBe(true);
    expect(listAllSchedules(db)[0].outcome).toBe("passed");
    expect(setStageOutcome(db, jobId, "Screen", null)).toBe(true);
    expect(listAllSchedules(db)[0].outcome).toBeNull();
    expect(setStageOutcome(db, jobId, "Panel", "failed")).toBe(false); // not booked
  });

  it("feeds round win rates into stats", async () => {
    const { setStageOutcome, upsertStageSchedule } = await import(
      "@/server/schedule"
    );
    const { getStats } = await import("@/server/stats");
    const { createJob } = await import("@/server/jobs");
    const other = createJob(
      db,
      jobCreateSchema.parse({ company: "B", role: "R", status: "Screen" }),
    );
    upsertStageSchedule(db, jobId, "Screen", "2026-07-10");
    upsertStageSchedule(db, other.id, "Screen", "2026-07-12");
    setStageOutcome(db, jobId, "Screen", "passed");
    setStageOutcome(db, other.id, "Screen", "failed");
    const rounds = getStats(db).roundStats;
    const screen = rounds.find((r) => r.stage === "Screen");
    expect(screen).toMatchObject({ stage: "Screen", passed: 1, failed: 1 });
    expect(rounds.find((r) => r.stage === "Panel")).toBeUndefined();
  });
});

describe("Applied schedule syncs dateApplied", () => {
  it("booking the Applied step writes jobs.dateApplied", async () => {
    const { upsertStageSchedule } = await import("@/server/schedule");
    upsertStageSchedule(db, jobId, "Applied", "2026-07-21");
    expect(getJob(db, jobId)?.dateApplied).toBe("2026-07-21");
  });
});

describe("activity log", () => {
  it("adds entries newest-first and deletes them", () => {
    addActivity(
      db,
      jobId,
      activityCreateSchema.parse({ note: "first" }),
      new Date(2026, 6, 10),
    );
    const second = addActivity(
      db,
      jobId,
      activityCreateSchema.parse({ note: "second" }),
      new Date(2026, 6, 15),
    );
    const log = listActivity(db, jobId);
    expect(log.map((a) => a.note)).toEqual(["second", "first"]);
    expect(deleteActivity(db, second.id)).toBe(true);
    expect(listActivity(db, jobId)).toHaveLength(1);
  });

  it("rejects an empty note", () => {
    expect(() => activityCreateSchema.parse({ note: "   " })).toThrow();
  });
});
