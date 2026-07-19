import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema, jobPatchSchema, listQuerySchema } from "@/lib/schemas";
import {
  createJob,
  deleteJob,
  getJob,
  listJobs,
  updateJob,
} from "@/server/jobs";

const TODAY = new Date(2026, 6, 17, 12, 0, 0);

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

const make = (overrides: Record<string, unknown> = {}) =>
  createJob(db, jobCreateSchema.parse({ company: "Acme", role: "Senior SRE", ...overrides }));

describe("createJob", () => {
  it("persists a job with defaults and returns it", () => {
    const job = make();
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("Evaluating");
    expect(job.priorityTier).toBe("3 - Mid");
    expect(job.createdAt).toBeTruthy();
  });

  it("keeps a caller-supplied id (seed import)", () => {
    expect(make({ id: "job-001" }).id).toBe("job-001");
  });

  it("records provenance: manual by default, overridable per caller", () => {
    expect(make().source).toBe("manual");
    expect(
      createJob(
        db,
        jobCreateSchema.parse({ company: "X", role: "Y" }),
        new Date(),
        "discovery",
      ).source,
    ).toBe("discovery");
  });

  it("writes an initial status_history row with null fromStatus", () => {
    const job = make({ status: "Applied" });
    const detail = getJob(db, job.id);
    expect(detail?.statusHistory).toHaveLength(1);
    expect(detail?.statusHistory[0].fromStatus).toBeNull();
    expect(detail?.statusHistory[0].toStatus).toBe("Applied");
  });
});

describe("updateJob", () => {
  it("appends a history row when status changes", () => {
    const job = make();
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Applied" }));
    const detail = getJob(db, job.id);
    expect(detail?.status).toBe("Applied");
    expect(detail?.statusHistory).toHaveLength(2);
    expect(detail?.statusHistory[1]).toMatchObject({
      fromStatus: "Evaluating",
      toStatus: "Applied",
    });
  });

  it("does not append history when status is unchanged or absent", () => {
    const job = make();
    updateJob(db, job.id, jobPatchSchema.parse({ notes: "pinged recruiter" }));
    updateJob(db, job.id, jobPatchSchema.parse({ status: "Evaluating" }));
    expect(getJob(db, job.id)?.statusHistory).toHaveLength(1);
  });

  it("clears a nullable field on explicit null", () => {
    const job = make({ followUpDate: "2026-07-20" });
    const updated = updateJob(db, job.id, jobPatchSchema.parse({ followUpDate: null }));
    expect(updated?.followUpDate).toBeNull();
  });

  it("bumps updatedAt", () => {
    // explicit stamps on both sides: wall-clock "now" must never race a
    // hardcoded update time
    const job = createJob(
      db,
      jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
      new Date(2026, 6, 17, 12, 0, 0),
    );
    const updated = updateJob(
      db,
      job.id,
      jobPatchSchema.parse({ notes: "x" }),
      new Date(2026, 6, 18, 9, 0, 0),
    );
    expect(updated!.updatedAt > job.updatedAt).toBe(true);
  });

  it("returns null for an unknown id", () => {
    expect(updateJob(db, "nope", jobPatchSchema.parse({ notes: "x" }))).toBeNull();
  });
});

describe("deleteJob", () => {
  it("deletes the job and cascades its history", () => {
    const job = make();
    expect(deleteJob(db, job.id)).toBe(true);
    expect(getJob(db, job.id)).toBeNull();
    const rows = db.$client
      .prepare("SELECT COUNT(*) AS n FROM status_history")
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it("returns false for an unknown id", () => {
    expect(deleteJob(db, "nope")).toBe(false);
  });
});

describe("listJobs", () => {
  beforeEach(() => {
    make({ company: "Platform Science", role: "Senior Platform Engineer", status: "Applied", priorityTier: "1 - Top", followUpDate: "2026-07-10" });
    make({ company: "Babylist", role: "Staff SRE", status: "Screen", priorityTier: "2 - High", followUpDate: "2026-07-25" });
    make({ company: "PrizePicks", role: "DevOps Engineer", status: "Rejected", priorityTier: "Closed", notes: "AWS-heavy stack", contact: "Dana R." });
  });

  it("returns everything without filters", () => {
    expect(listJobs(db, listQuerySchema.parse({}), TODAY)).toHaveLength(3);
  });

  it("filters by status and tier", () => {
    expect(listJobs(db, listQuerySchema.parse({ status: "Applied" }), TODAY)).toHaveLength(1);
    expect(listJobs(db, listQuerySchema.parse({ tier: "2 - High" }), TODAY)).toHaveLength(1);
  });

  it("filters by dueOnly: past-or-today only", () => {
    const due = listJobs(db, listQuerySchema.parse({ dueOnly: "true" }), TODAY);
    expect(due).toHaveLength(1);
    expect(due[0].company).toBe("Platform Science");
  });

  it("searches company, role, notes, and contact case-insensitively", () => {
    expect(listJobs(db, listQuerySchema.parse({ q: "babylist" }), TODAY)).toHaveLength(1);
    expect(listJobs(db, listQuerySchema.parse({ q: "sre" }), TODAY)).toHaveLength(1);
    expect(listJobs(db, listQuerySchema.parse({ q: "aws-heavy" }), TODAY)).toHaveLength(1);
    expect(listJobs(db, listQuerySchema.parse({ q: "dana" }), TODAY)).toHaveLength(1);
    expect(listJobs(db, listQuerySchema.parse({ q: "zzz" }), TODAY)).toHaveLength(0);
  });
});
