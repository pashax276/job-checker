import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import {
  eddReportClearSchema,
  eddReportSetSchema,
  jobCreateSchema,
} from "@/lib/schemas";
import {
  clearEddReport,
  listEddReports,
  listEddStagesByJob,
  setEddReport,
} from "@/server/edd";
import { createJob, deleteJob, getJob } from "@/server/jobs";

let db: DB;
let jobId: string;

const mark = (stage: string, reportedOn: string, now?: Date) =>
  setEddReport(db, jobId, eddReportSetSchema.parse({ stage, reportedOn }), now);

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  jobId = createJob(
    db,
    jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
  ).id;
});

describe("setEddReport", () => {
  it("records the stage and the day it was reported", () => {
    const report = mark("Applied", "2026-10-05", new Date("2026-10-05T18:00:00Z"));
    expect(report).toMatchObject({
      jobId,
      stage: "Applied",
      reportedOn: "2026-10-05",
      createdAt: "2026-10-05T18:00:00.000Z",
    });
    expect(listEddReports(db, jobId)).toEqual([report]);
  });

  it("moves the date when the same stage is marked again, keeping one row", () => {
    const first = mark("Applied", "2026-10-05");
    const second = mark("Applied", "2026-10-07");
    expect(second.id).toBe(first.id);
    expect(second.reportedOn).toBe("2026-10-07");
    expect(listEddReports(db, jobId)).toHaveLength(1);
  });

  it("keeps a separate report per stage, oldest report first", () => {
    mark("HM Interview", "2026-10-19");
    mark("Applied", "2026-10-05");
    expect(listEddReports(db, jobId).map((r) => r.stage)).toEqual([
      "Applied",
      "HM Interview",
    ]);
  });

  it("orders two reports filed the same day by when they were marked", () => {
    mark("Screen", "2026-10-12", new Date("2026-10-12T20:00:00Z"));
    mark("Applied", "2026-10-12", new Date("2026-10-12T19:00:00Z"));
    expect(listEddReports(db, jobId).map((r) => r.stage)).toEqual([
      "Applied",
      "Screen",
    ]);
  });
});

describe("clearEddReport", () => {
  it("removes one stage's report and leaves the others", () => {
    mark("Applied", "2026-10-05");
    mark("Screen", "2026-10-12");
    expect(clearEddReport(db, jobId, "Applied")).toBe(true);
    expect(listEddReports(db, jobId).map((r) => r.stage)).toEqual(["Screen"]);
  });

  it("reports false when that stage was never marked", () => {
    expect(clearEddReport(db, jobId, "Panel")).toBe(false);
  });
});

describe("job integration", () => {
  it("getJob carries the job's reports", () => {
    mark("Applied", "2026-10-05");
    expect(getJob(db, jobId)?.eddReports).toHaveLength(1);
  });

  it("deleting the job removes its reports", () => {
    mark("Applied", "2026-10-05");
    deleteJob(db, jobId);
    const rows = db.$client
      .prepare("SELECT COUNT(*) AS n FROM edd_reports")
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it("listEddStagesByJob groups reported stages per job", () => {
    const other = createJob(
      db,
      jobCreateSchema.parse({ company: "Beta", role: "Platform Engineer" }),
    ).id;
    const untouched = createJob(
      db,
      jobCreateSchema.parse({ company: "Gamma", role: "DevOps" }),
    ).id;
    mark("Applied", "2026-10-05");
    mark("Screen", "2026-10-12");
    setEddReport(
      db,
      other,
      eddReportSetSchema.parse({ stage: "Offer", reportedOn: "2026-10-20" }),
    );
    const byJob = listEddStagesByJob(db);
    expect(byJob.get(jobId)).toEqual(["Applied", "Screen"]);
    expect(byJob.get(other)).toEqual(["Offer"]);
    expect(byJob.has(untouched)).toBe(false);
  });
});

describe("eddReportSetSchema", () => {
  it.each(["Evaluating", "Skipped", "Rejected", "Phone"])(
    "rejects %s — not a work-search contact",
    (stage) => {
      expect(() =>
        eddReportSetSchema.parse({ stage, reportedOn: "2026-10-05" }),
      ).toThrow();
    },
  );

  it.each(["10/05/2026", "2026-10-5", "", "2026-13-01", "2026-02-30"])(
    "rejects %j as a report date",
    (reportedOn) => {
      expect(() =>
        eddReportSetSchema.parse({ stage: "Applied", reportedOn }),
      ).toThrow();
    },
  );

  it("rejects unknown keys", () => {
    expect(() =>
      eddReportSetSchema.parse({
        stage: "Applied",
        reportedOn: "2026-10-05",
        note: "x",
      }),
    ).toThrow();
  });

  it("the clear schema accepts only reportable stages", () => {
    expect(eddReportClearSchema.parse({ stage: "Offer" })).toEqual({
      stage: "Offer",
    });
    expect(() => eddReportClearSchema.parse({ stage: "Evaluating" })).toThrow();
  });
});
