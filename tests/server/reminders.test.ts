import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema, jobPatchSchema } from "@/lib/schemas";
import { createJob, updateJob } from "@/server/jobs";
import { computeReminders, dismissReminder } from "@/server/reminders";

const TODAY = new Date(2026, 6, 18, 12, 0, 0);

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

describe("computeReminders", () => {
  it("flags Applied jobs with no reply after 7+ days and no follow-up set", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "SlowCo",
        role: "SRE",
        status: "Applied",
        dateApplied: "2026-07-05",
      }),
      new Date(2026, 6, 5),
    );
    const reminders = computeReminders(db, TODAY);
    expect(reminders.some((r) => r.rule === "no-reply" && r.company === "SlowCo")).toBe(true);
  });

  it("does not flag Applied jobs that already have a follow-up date", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "PlannedCo",
        role: "SRE",
        status: "Applied",
        dateApplied: "2026-07-01",
        followUpDate: "2026-07-25",
      }),
      new Date(2026, 6, 1),
    );
    expect(
      computeReminders(db, TODAY).filter((r) => r.company === "PlannedCo"),
    ).toHaveLength(0);
  });

  it("suggests a thank-you note within 2 days of entering an interview stage", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "LoopCo", role: "SRE", status: "Applied" }),
      new Date(2026, 6, 1),
    );
    updateJob(
      db,
      job.id,
      jobPatchSchema.parse({ status: "HM Interview" }),
      new Date(2026, 6, 17, 9, 0, 0),
    );
    const reminders = computeReminders(db, TODAY);
    expect(
      reminders.some((r) => r.rule === "thank-you" && r.company === "LoopCo"),
    ).toBe(true);
  });

  it("does not suggest thank-you for stale interview stages or import stamps", () => {
    // entered Panel 10 days ago -> too old
    const old = createJob(
      db,
      jobCreateSchema.parse({ company: "OldLoop", role: "SRE", status: "Applied" }),
      new Date(2026, 6, 1),
    );
    updateJob(db, old.id, jobPatchSchema.parse({ status: "Panel" }), new Date(2026, 6, 8));
    // imported directly as Screen yesterday (initial row, fromStatus null)
    createJob(
      db,
      jobCreateSchema.parse({ company: "ImportedLoop", role: "SRE", status: "Screen" }),
      new Date(2026, 6, 17),
    );
    const companies = computeReminders(db, TODAY)
      .filter((r) => r.rule === "thank-you")
      .map((r) => r.company);
    expect(companies).not.toContain("OldLoop");
    expect(companies).not.toContain("ImportedLoop");
  });

  it("flags Evaluating jobs older than 14 days", () => {
    createJob(
      db,
      jobCreateSchema.parse({ company: "StaleCo", role: "SRE" }),
      new Date(2026, 6, 1),
    );
    expect(
      computeReminders(db, TODAY).some(
        (r) => r.rule === "stale-evaluating" && r.company === "StaleCo",
      ),
    ).toBe(true);
  });

  it("ignores inactive jobs entirely", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "DeadCo",
        role: "SRE",
        status: "Rejected",
        dateApplied: "2026-06-01",
      }),
      new Date(2026, 5, 1),
    );
    expect(computeReminders(db, TODAY).filter((r) => r.company === "DeadCo")).toHaveLength(0);
  });

  it("dismissed reminders stay dismissed", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "SlowCo",
        role: "SRE",
        status: "Applied",
        dateApplied: "2026-07-05",
      }),
      new Date(2026, 6, 5),
    );
    const before = computeReminders(db, TODAY);
    const target = before.find((r) => r.rule === "no-reply")!;
    dismissReminder(db, target.key);
    const after = computeReminders(db, TODAY);
    expect(after.find((r) => r.key === target.key)).toBeUndefined();
  });
});
