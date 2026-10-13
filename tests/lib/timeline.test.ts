import { describe, expect, it } from "vitest";
import { buildTimeline, type TimelineItem } from "@/lib/timeline";
import type {
  ActivityEntry,
  EddReport,
  StatusHistoryEntry,
} from "@/lib/types";

const JOB = "job-1";

// Local noon/afternoon stamps: far enough from midnight that the local day is
// the same in every timezone the suite realistically runs in.
const at = (month: number, day: number, hour = 12): string =>
  new Date(2026, month - 1, day, hour, 0, 0).toISOString();

const status = (
  id: string,
  toStatus: StatusHistoryEntry["toStatus"],
  changedAt: string,
): StatusHistoryEntry => ({
  id,
  jobId: JOB,
  fromStatus: null,
  toStatus,
  changedAt,
});

const note = (id: string, createdAt: string): ActivityEntry => ({
  id,
  jobId: JOB,
  note: `note ${id}`,
  createdAt,
});

const report = (
  id: string,
  stage: EddReport["stage"],
  reportedOn: string,
  createdAt: string,
): EddReport => ({ id, jobId: JOB, stage, reportedOn, createdAt });

const label = (item: TimelineItem): string =>
  item.kind === "status"
    ? `status:${item.status.id}`
    : item.kind === "note"
      ? `note:${item.note.id}`
      : `edd:${item.report.id}`;

describe("buildTimeline", () => {
  it("merges status changes, notes and EDD reports newest first", () => {
    const items = buildTimeline({
      statusHistory: [status("s1", "Applied", at(10, 1))],
      activityLog: [note("n1", at(10, 3))],
      eddReports: [report("e1", "Applied", "2026-10-05", at(10, 5))],
    });
    expect(items.map(label)).toEqual(["edd:e1", "note:n1", "status:s1"]);
  });

  it("stamps an EDD row with the day it was reported, not when it was marked", () => {
    const [item] = buildTimeline({
      statusHistory: [],
      activityLog: [],
      eddReports: [report("e1", "Applied", "2026-10-05", at(10, 12))],
    });
    expect(item.ts).toBe("2026-10-05");
  });

  it("places a backfilled report on its reported day, below later events", () => {
    const items = buildTimeline({
      statusHistory: [
        status("s1", "Applied", at(10, 1)),
        status("s2", "Screen", at(10, 8)),
      ],
      activityLog: [],
      // marked on the 12th, but it went on EDD on the 5th
      eddReports: [report("e1", "Applied", "2026-10-05", at(10, 12))],
    });
    expect(items.map(label)).toEqual(["status:s2", "edd:e1", "status:s1"]);
  });

  it("puts a report above the same-day status change it followed", () => {
    const items = buildTimeline({
      statusHistory: [status("s1", "Screen", at(10, 12, 10))],
      activityLog: [note("n1", at(10, 12, 16))],
      eddReports: [report("e1", "Screen", "2026-10-12", at(10, 12, 11))],
    });
    expect(items.map(label)).toEqual(["note:n1", "edd:e1", "status:s1"]);
  });

  it("orders a date-only status stamp by its calendar day", () => {
    const items = buildTimeline({
      // imported history can carry a bare date instead of a timestamp
      statusHistory: [status("s1", "Applied", "2026-10-05")],
      activityLog: [note("n1", at(10, 4))],
      eddReports: [report("e1", "Applied", "2026-10-06", at(10, 6))],
    });
    expect(items.map(label)).toEqual(["edd:e1", "status:s1", "note:n1"]);
  });

  it("returns an empty list for a job with no history", () => {
    expect(
      buildTimeline({ statusHistory: [], activityLog: [], eddReports: [] }),
    ).toEqual([]);
  });

  it("does not reorder the arrays it was given", () => {
    const statusHistory = [
      status("s1", "Applied", at(10, 1)),
      status("s2", "Screen", at(10, 8)),
    ];
    buildTimeline({ statusHistory, activityLog: [], eddReports: [] });
    expect(statusHistory.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});
