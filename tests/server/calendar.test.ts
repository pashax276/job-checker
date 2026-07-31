import { beforeEach, describe, expect, it } from "vitest";
import { legendKinds } from "@/components/month-calendar";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import type { CalendarEvent } from "@/lib/types";
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

describe("calendar legend", () => {
  const event = (kind: string): CalendarEvent => ({
    kind,
    date: "2026-07-20",
    jobId: "j",
    company: "C",
  });

  it("lists exactly the kinds actually plotted, in pipeline order", () => {
    expect(
      legendKinds([event("Follow-up"), event("Applied"), event("Screen")]),
    ).toEqual(["Applied", "Screen", "Follow-up"]);
  });

  it("includes Applied — the regression: the old hardcoded legend omitted it, leaving its blue dots undecodable", () => {
    expect(legendKinds([event("Applied")])).toEqual(["Applied"]);
  });

  it("omits kinds with no events — the old legend advertised Panel even when nothing was booked at that stage", () => {
    expect(legendKinds([event("Screen")])).not.toContain("Panel");
  });

  it("covers every schedulable stage, not just the four that were hardcoded", () => {
    const all = ["Applied", "Screen", "Assessment", "HM Interview", "Panel", "Offer"];
    expect(legendKinds(all.map(event))).toEqual(all);
  });

  it("is empty when there is nothing on the calendar", () => {
    expect(legendKinds([])).toEqual([]);
  });
});
