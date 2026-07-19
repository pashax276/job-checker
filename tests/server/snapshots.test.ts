import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import { createJob } from "@/server/jobs";
import {
  ensureWeeklySnapshot,
  listSnapshots,
  weekStartIso,
} from "@/server/snapshots";

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

describe("weekStartIso", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartIso(new Date(2026, 6, 19, 12))).toBe("2026-07-13"); // Sunday
    expect(weekStartIso(new Date(2026, 6, 13, 12))).toBe("2026-07-13"); // Monday
    expect(weekStartIso(new Date(2026, 6, 15, 12))).toBe("2026-07-13"); // Wednesday
  });
});

describe("ensureWeeklySnapshot", () => {
  it("captures the pipeline once per week, idempotently", () => {
    createJob(db, jobCreateSchema.parse({ company: "A", role: "R", status: "Applied" }));
    createJob(db, jobCreateSchema.parse({ company: "B", role: "R", status: "Rejected" }));
    const first = ensureWeeklySnapshot(db, new Date(2026, 6, 19, 12));
    const second = ensureWeeklySnapshot(db, new Date(2026, 6, 19, 12));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    const rows = listSnapshots(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].weekStart).toBe("2026-07-13");
    expect(rows[0].totalJobs).toBe(2);
    expect(rows[0].activeTotal).toBe(1);
    expect(JSON.parse(rows[0].statusCounts).Applied).toBe(1);
  });

  it("creates a new row when a new week starts", () => {
    ensureWeeklySnapshot(db, new Date(2026, 6, 19, 12));
    ensureWeeklySnapshot(db, new Date(2026, 6, 21, 12)); // next week (Tue)
    const rows = listSnapshots(db);
    expect(rows.map((r) => r.weekStart)).toEqual(["2026-07-13", "2026-07-20"]);
  });
});
