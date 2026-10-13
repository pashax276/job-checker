import { localDayOf } from "@/lib/dates";
import type {
  ActivityEntry,
  EddReport,
  JobDetail,
  StatusHistoryEntry,
} from "@/lib/types";

/** One row of the drawer's timeline; `ts` is the stamp the row displays. */
export type TimelineItem =
  | { kind: "status"; ts: string; status: StatusHistoryEntry }
  | { kind: "note"; ts: string; note: ActivityEntry }
  | { kind: "edd"; ts: string; report: EddReport };

interface Placed {
  item: TimelineItem;
  /** Local calendar day the row belongs to. */
  day: string;
  /** Orders rows within a day. */
  moment: string;
}

const descending = (a: string, b: string): number =>
  a === b ? 0 : a < b ? 1 : -1;

/**
 * A job's status changes, notes and EDD reports as one list, newest first.
 *
 * Rows are ordered by local day and only then by the moment they were
 * recorded. An EDD report belongs to the day it was filed, which is not
 * always the day it was marked here — a report backfilled a week later must
 * land a week back, not at the top. Within its day it sorts by when it was
 * marked, so one filed right after a status change sits just above it.
 */
export function buildTimeline(
  job: Pick<JobDetail, "statusHistory" | "activityLog" | "eddReports">,
): TimelineItem[] {
  const placed: Placed[] = [
    ...job.statusHistory.map<Placed>((entry) => ({
      item: { kind: "status", ts: entry.changedAt, status: entry },
      day: localDayOf(entry.changedAt),
      moment: entry.changedAt,
    })),
    ...job.activityLog.map<Placed>((entry) => ({
      item: { kind: "note", ts: entry.createdAt, note: entry },
      day: localDayOf(entry.createdAt),
      moment: entry.createdAt,
    })),
    ...job.eddReports.map<Placed>((report) => ({
      item: { kind: "edd", ts: report.reportedOn, report },
      day: report.reportedOn,
      moment: report.createdAt,
    })),
  ];
  return placed
    .sort((a, b) => descending(a.day, b.day) || descending(a.moment, b.moment))
    .map((entry) => entry.item);
}
