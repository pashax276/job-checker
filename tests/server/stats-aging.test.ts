import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema, jobPatchSchema } from "@/lib/schemas";
import { createJob, updateJob } from "@/server/jobs";
import { getStats } from "@/server/stats";

const IMPORT_DAY = new Date(2026, 6, 17, 12, 0, 0);
const TODAY = new Date(2026, 6, 27, 12, 0, 0);

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

const aging = (company: string) => {
  const stats = getStats(db, TODAY);
  return stats.aging.find((a) => a.company === company)?.daysInCurrentStage;
};

describe("aging stage-start fallback for history-less imports", () => {
  it("uses dateApplied when the only history row is the import stamp", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "ImportedCo",
        role: "Senior SRE",
        status: "Applied",
        dateApplied: "2026-06-20",
      }),
      IMPORT_DAY,
    );
    // without the fallback this would be 10 (17th -> 27th); with it, 37 days
    expect(aging("ImportedCo")).toBe(37);
  });

  it("uses real history once a status change exists", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "TrackedCo",
        role: "Senior SRE",
        status: "Applied",
        dateApplied: "2026-06-20",
      }),
      IMPORT_DAY,
    );
    updateJob(
      db,
      job.id,
      jobPatchSchema.parse({ status: "Screen" }),
      new Date(2026, 6, 20, 9, 0, 0),
    );
    expect(aging("TrackedCo")).toBe(7);
  });

  it("keeps the history stamp when there is no dateApplied", () => {
    createJob(
      db,
      jobCreateSchema.parse({ company: "FreshCo", role: "Senior SRE" }),
      IMPORT_DAY,
    );
    expect(aging("FreshCo")).toBe(10);
  });

  it("ignores a dateApplied that is later than the history stamp", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "FutureCo",
        role: "Senior SRE",
        status: "Applied",
        dateApplied: "2026-07-20",
      }),
      IMPORT_DAY,
    );
    expect(aging("FutureCo")).toBe(10);
  });
});
