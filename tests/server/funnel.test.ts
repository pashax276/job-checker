import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema, jobPatchSchema } from "@/lib/schemas";
import { createJob, updateJob } from "@/server/jobs";
import { getStats } from "@/server/stats";

const TODAY = new Date(2026, 6, 18, 12, 0, 0);

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

const funnelOf = () => {
  const funnel = getStats(db, TODAY).funnel;
  return Object.fromEntries(funnel.map((f) => [f.status, f.reached]));
};

describe("stats funnel", () => {
  it("counts every job as having reached Evaluating", () => {
    createJob(db, jobCreateSchema.parse({ company: "A", role: "R" }));
    createJob(
      db,
      jobCreateSchema.parse({ company: "B", role: "R", status: "Rejected" }),
    );
    expect(funnelOf().Evaluating).toBe(2);
  });

  it("uses real history transitions for reached stages", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "A", role: "R", status: "Applied" }),
    );
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Screen" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Rejected" }));
    const reached = funnelOf();
    expect(reached.Applied).toBe(1);
    expect(reached.Screen).toBe(1);
    expect(reached.Assessment).toBe(0);
  });

  it("infers Applied from dateApplied for history-less imports", () => {
    createJob(
      db,
      jobCreateSchema.parse({
        company: "Imported",
        role: "R",
        status: "Rejected",
        dateApplied: "2026-06-01",
      }),
    );
    expect(funnelOf().Applied).toBe(1);
  });

  it("moving a job backward drops the higher stage (correction, not regression)", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "MovedBack", role: "R", status: "Applied" }),
    );
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Screen" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Panel" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "HM Interview" }));
    const reached = funnelOf();
    expect(reached["HM Interview"]).toBe(1);
    expect(reached.Panel).toBe(0); // corrected away — the job is not past Panel
    expect(reached.Screen).toBe(1); // implied by current position
  });

  it("terminal jobs still credit the stage they closed from", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "RejectedLate", role: "R", status: "Applied" }),
    );
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Screen" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Panel" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Rejected" }));
    const reached = funnelOf();
    expect(reached.Panel).toBe(1); // real drop-off after Panel is preserved
  });

  it("counts the current pipeline stage as reached", () => {
    createJob(
      db,
      jobCreateSchema.parse({ company: "PanelCo", role: "R", status: "Panel" }),
    );
    const reached = funnelOf();
    expect(reached.Panel).toBe(1);
    expect(reached.Offer).toBe(0);
  });

  it("reports conversion relative to the previous stage", () => {
    createJob(db, jobCreateSchema.parse({ company: "A", role: "R", status: "Applied", dateApplied: "2026-07-01" }));
    createJob(db, jobCreateSchema.parse({ company: "B", role: "R", status: "Applied", dateApplied: "2026-07-01" }));
    createJob(db, jobCreateSchema.parse({ company: "C", role: "R", status: "Screen" }));
    createJob(db, jobCreateSchema.parse({ company: "D", role: "R" }));
    const funnel = getStats(db, TODAY).funnel;
    const applied = funnel.find((f) => f.status === "Applied")!;
    const screen = funnel.find((f) => f.status === "Screen")!;
    expect(applied.reached).toBe(3); // A, B via dateApplied/status; C implied by Screen? no — C has no dateApplied and status Screen counts Screen but Applied only via order
    expect(screen.reached).toBe(1);
    expect(screen.conversion).toBeCloseTo(1 / 3);
    expect(funnel[0].conversion).toBeNull();
  });
});
