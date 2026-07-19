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
