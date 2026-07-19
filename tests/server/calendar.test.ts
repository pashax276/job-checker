import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import { createJob } from "@/server/jobs";
import { upsertStageSchedule } from "@/server/schedule";
import { getStats } from "@/server/stats";

const TODAY = new Date(2026, 6, 19, 12, 0, 0);

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

describe("stats calendar events", () => {
  it("merges booked steps and upcoming follow-ups, sorted by date", () => {
    const a = createJob(
      db,
      jobCreateSchema.parse({ company: "Qualcomm", role: "R", status: "HM Interview" }),
    );
    const b = createJob(
      db,
      jobCreateSchema.parse({ company: "Incode", role: "R", status: "Screen" }),
    );
    createJob(
      db,
      jobCreateSchema.parse({
        company: "FICO",
        role: "R",
        status: "Applied",
        followUpDate: "2026-07-25",
      }),
    );
    upsertStageSchedule(db, a.id, "HM Interview", "2026-07-21");
    upsertStageSchedule(db, b.id, "Screen", "2026-07-20");

    const events = getStats(db, TODAY).events;
    expect(events.map((e) => `${e.company}:${e.kind}:${e.date}`)).toEqual([
      "Incode:Screen:2026-07-20",
      "Qualcomm:HM Interview:2026-07-21",
      "FICO:Follow-up:2026-07-25",
    ]);
  });

  it("includes past bookings (a real calendar shows history) but never inactive follow-ups", () => {
    const old = createJob(
      db,
      jobCreateSchema.parse({ company: "PastCo", role: "R", status: "Screen" }),
    );
    upsertStageSchedule(db, old.id, "Screen", "2026-07-01");
    createJob(
      db,
      jobCreateSchema.parse({
        company: "DeadCo",
        role: "R",
        status: "Rejected",
        followUpDate: "2026-07-30",
      }),
    );
    const events = getStats(db, TODAY).events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ company: "PastCo", date: "2026-07-01" });
  });

  it("includes a same-day event", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "TodayCo", role: "R", status: "Panel" }),
    );
    upsertStageSchedule(db, job.id, "Panel", "2026-07-19");
    expect(getStats(db, TODAY).events).toHaveLength(1);
  });
});
