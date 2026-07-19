import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema, jobPatchSchema } from "@/lib/schemas";
import { createJob, updateJob } from "@/server/jobs";
import { getStats } from "@/server/stats";

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

describe("response stats", () => {
  it("computes applied→advanced rate and average days to first response", () => {
    // advanced after 5 days
    const a = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        status: "Applied",
        dateApplied: "2026-07-01",
        priorityTier: "1 - Top",
      }),
    );
    updateJob(db, a.id, jobPatchSchema.parse({ status: "Screen" }), new Date(2026, 6, 6, 12));
    // advanced after 9 days
    const b = createJob(
      db,
      jobCreateSchema.parse({
        company: "B",
        role: "R",
        status: "Applied",
        dateApplied: "2026-07-01",
        priorityTier: "2 - High",
      }),
    );
    updateJob(db, b.id, jobPatchSchema.parse({ status: "HM Interview" }), new Date(2026, 6, 10, 12));
    // no response yet
    createJob(
      db,
      jobCreateSchema.parse({
        company: "C",
        role: "R",
        status: "Applied",
        dateApplied: "2026-07-01",
        priorityTier: "1 - Top",
      }),
    );
    // never applied — excluded entirely
    createJob(db, jobCreateSchema.parse({ company: "D", role: "R" }));

    const response = getStats(db, new Date(2026, 6, 19, 12)).response;
    expect(response.applied).toBe(3);
    expect(response.advanced).toBe(2);
    expect(response.rate).toBeCloseTo(2 / 3);
    expect(response.avgDaysToFirstResponse).toBe(7); // (5 + 9) / 2
    const top = response.byTier.find((t) => t.tier === "1 - Top");
    expect(top).toMatchObject({ applied: 2, advanced: 1 });
  });

  it("rejection straight from Applied does not count as advancing", () => {
    const a = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        status: "Applied",
        dateApplied: "2026-07-01",
      }),
    );
    updateJob(db, a.id, jobPatchSchema.parse({ status: "Rejected" }));
    const response = getStats(db).response;
    expect(response.advanced).toBe(0);
    expect(response.rate).toBe(0);
    expect(response.avgDaysToFirstResponse).toBeNull();
  });
});
