import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import {
  ACTIVE_EXCLUDED_STATUSES,
  TERMINAL_STATUSES,
} from "@/lib/constants";
import { jobCreateSchema, jobPatchSchema } from "@/lib/schemas";
import { createJob, updateJob } from "@/server/jobs";
import { upsertStageSchedule } from "@/server/schedule";
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

  it("does not credit Applied from a stray dateApplied when current status is Evaluating", () => {
    // Reproduces a real bug: the status dropdown briefly touched "Applied"
    // (client-side prefilling dateApplied) before the user picked
    // "Evaluating" and saved — one net PATCH lands with status=Evaluating
    // but a dateApplied value still attached. Current status is the truth.
    createJob(
      db,
      jobCreateSchema.parse({
        company: "StrayDate",
        role: "R",
        status: "Evaluating",
        dateApplied: "2026-07-09",
      }),
    );
    const reached = funnelOf();
    expect(reached.Evaluating).toBe(1);
    expect(reached.Applied).toBe(0);
  });

  it("does not credit Applied from a stray dateApplied on a job skipped straight from Evaluating", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "SkippedEarly", role: "R" }),
    );
    // Single patch: status jumps straight to Skipped, no Applied stop in
    // between, but dateApplied rode along from the same stuck form state.
    updateJob(
      db,
      job.id,
      jobPatchSchema.parse({ status: "Skipped", dateApplied: "2026-07-08" }),
    );
    const reached = funnelOf();
    expect(reached.Applied).toBe(0);
  });

  it("still infers Applied from dateApplied when a Rejected job has no flow history at all", () => {
    // The genuine history-less case: created directly into a terminal
    // status with no intermediate stages recorded — dateApplied is the
    // only evidence left that they applied (see "infers Applied from
    // dateApplied for history-less imports" above; this variant confirms
    // it survives alongside the stray-dateApplied fix).
    createJob(
      db,
      jobCreateSchema.parse({
        company: "RejectedNoHistory",
        role: "R",
        status: "Rejected",
        dateApplied: "2026-07-19",
      }),
    );
    expect(funnelOf().Applied).toBe(1);
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

// The flow bars stop at Offer by design, so the card never showed where the
// other ~80% of the pipeline actually went.
describe("stats terminal outcomes", () => {
  const terminalOf = () =>
    Object.fromEntries(
      getStats(db, TODAY).terminal.map((t) => [t.status, t]),
    );

  it("counts rejected and skipped jobs as their own terminal stages", () => {
    createJob(db, jobCreateSchema.parse({ company: "A", role: "R" }));
    createJob(
      db,
      jobCreateSchema.parse({ company: "B", role: "R", status: "Rejected" }),
    );
    createJob(
      db,
      jobCreateSchema.parse({ company: "C", role: "R", status: "Rejected" }),
    );
    createJob(
      db,
      jobCreateSchema.parse({ company: "D", role: "R", status: "Skipped" }),
    );
    const terminal = terminalOf();
    expect(terminal.Rejected.count).toBe(2);
    expect(terminal.Skipped.count).toBe(1);
  });

  it("shares are of every job that entered the funnel, matching the bars above", () => {
    for (const company of ["A", "B", "C", "D"]) {
      createJob(
        db,
        jobCreateSchema.parse({
          company,
          role: "R",
          status: company === "A" ? "Applied" : "Rejected",
        }),
      );
    }
    const stats = getStats(db, TODAY);
    const rejected = stats.terminal.find((t) => t.status === "Rejected")!;
    expect(stats.funnel[0].reached).toBe(4);
    expect(rejected.count).toBe(3);
    expect(rejected.share).toBeCloseTo(0.75);
  });

  it("reports both statuses even when neither has happened yet", () => {
    createJob(db, jobCreateSchema.parse({ company: "A", role: "R" }));
    const terminal = terminalOf();
    expect(terminal.Rejected.count).toBe(0);
    expect(terminal.Skipped.count).toBe(0);
    expect(terminal.Rejected.share).toBe(0);
  });

  it("has no share to report on an empty tracker", () => {
    expect(getStats(db, TODAY).terminal.every((t) => t.share === null)).toBe(true);
  });

  it("counts a rejection regardless of how far the job got", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "Deep", role: "R", status: "Applied" }),
    );
    updateJob(db, job.id, jobPatchSchema.parse({ status: "HM Interview" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Rejected" }));
    // Still credits HM Interview in the flow above...
    expect(getStats(db, TODAY).funnel.find((f) => f.status === "HM Interview")!.reached).toBe(1);
    // ...and shows up once as a rejection below.
    expect(terminalOf().Rejected.count).toBe(1);
  });
});

describe("terminal status list", () => {
  it("covers exactly the statuses excluded from the active pipeline", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(
      [...ACTIVE_EXCLUDED_STATUSES].sort(),
    );
  });

  it("leads with Rejected — the signal worth reading before self-selected skips", () => {
    expect(TERMINAL_STATUSES[0]).toBe("Rejected");
    expect(getStats(db, TODAY).terminal[0].status).toBe("Rejected");
  });
});

// Most rejections arrive by email straight after applying, never reaching a
// recruiter screen — and the funnel showed that correctly. What it missed was
// the opposite case: a job that got as far as an HM interview, then closed.
// Its only history row is the terminal status, which isn't in the flow, so it
// fell back to dateApplied and reported as if it never got past Applied.
describe("booked steps as evidence of stages reached", () => {
  const reachedOf = () =>
    Object.fromEntries(
      getStats(db, TODAY).funnel.map((f) => [f.status, f.reached]),
    );

  const closedJob = (company: string, status: "Rejected" | "Skipped") =>
    createJob(
      db,
      jobCreateSchema.parse({
        company,
        role: "R",
        status,
        dateApplied: "2026-06-01",
      }),
    );

  it("credits the furthest stage actually booked, not just Applied", () => {
    const job = closedJob("Incode", "Rejected");
    upsertStageSchedule(db, job.id, "Applied", "2026-07-01");
    upsertStageSchedule(db, job.id, "Screen", "2026-07-09");
    upsertStageSchedule(db, job.id, "HM Interview", "2026-07-16");
    const reached = reachedOf();
    expect(reached.Applied).toBe(1);
    expect(reached.Screen).toBe(1);
    expect(reached["HM Interview"]).toBe(1);
    expect(reached.Panel).toBe(0);
  });

  it("leaves an email rejection with no booked interview at Applied", () => {
    closedJob("Cold apply", "Rejected");
    const reached = reachedOf();
    expect(reached.Applied).toBe(1);
    expect(reached.Screen).toBe(0);
  });

  it("still counts a rejection once, however far it got", () => {
    const job = closedJob("Qualcomm", "Rejected");
    upsertStageSchedule(db, job.id, "HM Interview", "2026-06-29");
    const stats = getStats(db, TODAY);
    expect(stats.funnel.find((f) => f.status === "HM Interview")!.reached).toBe(1);
    expect(stats.terminal.find((t) => t.status === "Rejected")!.count).toBe(1);
  });

  it("does not let a booked step override a live card's current stage", () => {
    // Backward correction must keep working: an active card sitting at
    // Applied reports Applied, even if a later step was once booked.
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "MovedBack", role: "R", status: "Screen" }),
    );
    upsertStageSchedule(db, job.id, "HM Interview", "2026-07-16");
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Applied" }));
    const reached = reachedOf();
    expect(reached.Applied).toBe(1);
    expect(reached.Screen).toBe(0);
    expect(reached["HM Interview"]).toBe(0);
  });

  it("takes whichever of history and booked steps got further", () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "Both", role: "R", status: "Applied" }),
    );
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Screen" }));
    upsertStageSchedule(db, job.id, "Panel", "2026-07-20");
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Rejected" }));
    expect(reachedOf().Panel).toBe(1);
  });

  it("ignores a booked step for a job that never applied", () => {
    // Applied is booked as a stage too — booking it IS the application date,
    // so it can't imply more than Applied.
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "Skipped early", role: "R", status: "Skipped" }),
    );
    expect(reachedOf().Applied).toBe(0);
    expect(getStats(db, TODAY).funnel[0].reached).toBe(1);
    upsertStageSchedule(db, job.id, "Applied", "2026-07-01");
    expect(reachedOf().Applied).toBe(1);
  });
});
