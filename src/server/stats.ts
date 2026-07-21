import { and, asc, count, eq, inArray, isNotNull, lte, not, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, leads, stageSchedule, statusHistory } from "@/db/schema";
import {
  ACTIVE_EXCLUDED_STATUSES,
  PIPELINE_FLOW,
  STATUSES,
  type Status,
} from "@/lib/constants";
import { daysInCurrentStage, toLocalIsoDate } from "@/lib/dates";
import { listSnapshots } from "@/server/snapshots";

export interface OverdueItem {
  id: string;
  company: string;
  role: string;
  status: string;
  followUpDate: string;
  nextAction: string | null;
}

export interface AgingItem {
  id: string;
  company: string;
  role: string;
  status: string;
  daysInCurrentStage: number;
}

export interface FunnelStage {
  status: Status;
  reached: number;
  /** reached / previous stage's reached; null for the first stage. */
  conversion: number | null;
}

export interface CalendarEvent {
  date: string;
  jobId: string;
  company: string;
  /** A pipeline stage name, or "Follow-up". */
  kind: string;
}

export interface RoundStat {
  stage: string;
  passed: number;
  failed: number;
}

export interface ResponseStats {
  applied: number;
  advanced: number;
  rate: number | null;
  avgDaysToFirstResponse: number | null;
  byTier: Array<{ tier: string; applied: number; advanced: number }>;
}

export interface TrendPoint {
  weekStart: string;
  activeTotal: number;
  totalJobs: number;
}

export interface Stats {
  statusCounts: Record<Status, number>;
  activeTotal: number;
  overdue: OverdueItem[];
  aging: AgingItem[];
  funnel: FunnelStage[];
  events: CalendarEvent[];
  trend: TrendPoint[];
  roundStats: RoundStat[];
  response: ResponseStats;
  newLeads: number;
}

const activeCondition = () =>
  and(
    not(eq(jobs.priorityTier, "Closed")),
    notInArray(jobs.status, [...ACTIVE_EXCLUDED_STATUSES]),
  )!;

export function getStats(db: DB, today = new Date()): Stats {
  const counts = db
    .select({ status: jobs.status, n: count() })
    .from(jobs)
    .groupBy(jobs.status)
    .all();
  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [s, 0]),
  ) as Record<Status, number>;
  for (const row of counts) statusCounts[row.status as Status] = row.n;

  const activeTotal =
    db.select({ n: count() }).from(jobs).where(activeCondition()).get()?.n ?? 0;

  const overdue: OverdueItem[] = db
    .select({
      id: jobs.id,
      company: jobs.company,
      role: jobs.role,
      status: jobs.status,
      followUpDate: sql<string>`${jobs.followUpDate}`,
      nextAction: jobs.nextAction,
    })
    .from(jobs)
    .where(
      and(
        activeCondition(),
        isNotNull(jobs.followUpDate),
        lte(jobs.followUpDate, toLocalIsoDate(today)),
      ),
    )
    .orderBy(jobs.followUpDate)
    .all();

  // Last status change per active job drives the aging chart.
  const activeJobs = db
    .select({
      id: jobs.id,
      company: jobs.company,
      role: jobs.role,
      status: jobs.status,
      dateApplied: jobs.dateApplied,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(activeCondition())
    .all();
  const lastChanges = db
    .select({
      jobId: statusHistory.jobId,
      last: sql<string>`MAX(${statusHistory.changedAt})`,
      entries: count(),
    })
    .from(statusHistory)
    .where(
      inArray(
        statusHistory.jobId,
        activeJobs.map((j) => j.id),
      ),
    )
    .groupBy(statusHistory.jobId)
    .all();
  const historyByJob = new Map(lastChanges.map((r) => [r.jobId, r]));

  // Stage start = last recorded status change. Imported jobs carry only the
  // import stamp as history, which would make every bar identical — for those
  // (single history row) fall back to dateApplied when it is earlier. Exact
  // for Applied; an honest lower bound elsewhere; self-corrects as real
  // status changes accrue.
  const stageStart = (job: (typeof activeJobs)[number]): string => {
    const meta = historyByJob.get(job.id);
    const last = meta?.last ?? job.createdAt;
    if ((meta?.entries ?? 0) <= 1 && job.dateApplied && job.dateApplied < last) {
      return job.dateApplied;
    }
    return last;
  };

  const aging: AgingItem[] = activeJobs
    .map((j) => ({
      id: j.id,
      company: j.company,
      role: j.role,
      status: j.status,
      daysInCurrentStage: daysInCurrentStage(stageStart(j), today),
    }))
    .sort((a, b) => b.daysInCurrentStage - a.daysInCurrentStage);

  // Conversion funnel keyed to where each job stands NOW: the last pipeline
  // stage it occupied (implying passage through earlier stages), so moving a
  // card backward corrects the funnel rather than recording a phantom stage.
  // Terminal jobs credit the stage they closed from — that is the drop-off
  // signal. dateApplied implies at least Applied for history-less imports.
  const allJobs = db
    .select({
      id: jobs.id,
      status: jobs.status,
      dateApplied: jobs.dateApplied,
      priorityTier: jobs.priorityTier,
    })
    .from(jobs)
    .all();
  const historyStages = db
    .select({
      jobId: statusHistory.jobId,
      fromStatus: statusHistory.fromStatus,
      toStatus: statusHistory.toStatus,
      changedAt: statusHistory.changedAt,
    })
    .from(statusHistory)
    .orderBy(asc(statusHistory.changedAt))
    .all();
  const flowIndex = new Map(PIPELINE_FLOW.map((s, i) => [s as string, i]));
  // Chronological scan: the map ends up holding each job's LAST in-flow stage.
  const lastFlowStage = new Map<string, number>();
  for (const row of historyStages) {
    const idx = flowIndex.get(row.toStatus);
    if (idx !== undefined) lastFlowStage.set(row.jobId, idx);
  }
  const appliedIndex = flowIndex.get("Applied")!;
  const reachedIndexOf = (job: (typeof allJobs)[number]): number => {
    const current = flowIndex.get(job.status);
    if (current !== undefined) {
      // Active in the flow: current position is the truth. Trust it even
      // over a stale dateApplied — e.g. a card moved back to Evaluating or
      // Skipped without clearing a dateApplied set from an earlier status.
      return current;
    }
    const last = lastFlowStage.get(job.id);
    if (last !== undefined) {
      // Skipped/Rejected with real flow history: the last stage held
      // before closing, e.g. Evaluating -> Applied -> Rejected.
      return last;
    }
    // No current-status or historical flow signal at all — a bare
    // history-less import row (e.g. created straight into "Rejected" with
    // no intermediate stages recorded). dateApplied is the only evidence
    // left that they applied.
    return job.dateApplied ? appliedIndex : 0;
  };
  const reachedIndices = allJobs.map(reachedIndexOf);
  const funnel: FunnelStage[] = PIPELINE_FLOW.map((status, i) => ({
    status,
    reached: reachedIndices.filter((r) => r >= i).length,
    conversion: null as number | null,
  }));
  for (let i = 1; i < funnel.length; i++) {
    funnel[i] = {
      ...funnel[i],
      conversion:
        funnel[i - 1].reached > 0
          ? funnel[i].reached / funnel[i - 1].reached
          : null,
    };
  }

  // Calendar events: every booked stage date (past ones included — the
  // month grid shows history) plus active jobs' follow-ups, soonest first.
  const bookedEvents: CalendarEvent[] = db
    .select({
      date: stageSchedule.scheduledFor,
      jobId: stageSchedule.jobId,
      company: jobs.company,
      kind: stageSchedule.stage,
    })
    .from(stageSchedule)
    .innerJoin(jobs, eq(stageSchedule.jobId, jobs.id))
    .all();
  const followUpEvents: CalendarEvent[] = db
    .select({
      date: sql<string>`${jobs.followUpDate}`,
      jobId: jobs.id,
      company: jobs.company,
    })
    .from(jobs)
    .where(and(activeCondition(), isNotNull(jobs.followUpDate)))
    .all()
    .map((row) => ({ ...row, kind: "Follow-up" }));
  const events = [...bookedEvents, ...followUpEvents]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 200);

  const trend: TrendPoint[] = listSnapshots(db).map((row) => ({
    weekStart: row.weekStart,
    activeTotal: row.activeTotal,
    totalJobs: row.totalJobs,
  }));

  // Response analytics: of the jobs actually applied to, how many ever got
  // past Applied, and how fast did the first response come?
  const advancedStages = new Set(
    PIPELINE_FLOW.slice(appliedIndex + 1) as string[],
  );
  const firstAdvanceAt = new Map<string, string>();
  for (const row of historyStages) {
    if (
      !firstAdvanceAt.has(row.jobId) &&
      row.fromStatus === "Applied" &&
      advancedStages.has(row.toStatus)
    ) {
      firstAdvanceAt.set(row.jobId, row.changedAt);
    }
  }
  const appliedJobs = allJobs.filter((j) => j.dateApplied !== null);
  const advancedJobs = appliedJobs.filter(
    (j) => reachedIndexOf(j) > appliedIndex,
  );
  const responseDays = appliedJobs.flatMap((j) => {
    const advancedAt = firstAdvanceAt.get(j.id);
    return advancedAt
      ? [daysInCurrentStage(j.dateApplied!, new Date(advancedAt))]
      : [];
  });
  const tierMap = new Map<string, { applied: number; advanced: number }>();
  for (const job of appliedJobs) {
    const entry = tierMap.get(job.priorityTier) ?? { applied: 0, advanced: 0 };
    tierMap.set(job.priorityTier, {
      applied: entry.applied + 1,
      advanced:
        entry.advanced + (reachedIndexOf(job) > appliedIndex ? 1 : 0),
    });
  }
  const response: ResponseStats = {
    applied: appliedJobs.length,
    advanced: advancedJobs.length,
    rate: appliedJobs.length > 0 ? advancedJobs.length / appliedJobs.length : null,
    avgDaysToFirstResponse:
      responseDays.length > 0
        ? Math.round(
            (responseDays.reduce((a, b) => a + b, 0) / responseDays.length) * 10,
          ) / 10
        : null,
    byTier: [...tierMap.entries()].map(([tier, counts]) => ({
      tier,
      ...counts,
    })),
  };

  // Per-round win rates from explicit outcomes on held steps.
  const outcomeRows = db
    .select({ stage: stageSchedule.stage, outcome: stageSchedule.outcome })
    .from(stageSchedule)
    .where(isNotNull(stageSchedule.outcome))
    .all();
  const roundMap = new Map<string, RoundStat>();
  for (const row of outcomeRows) {
    const entry = roundMap.get(row.stage) ?? {
      stage: row.stage,
      passed: 0,
      failed: 0,
    };
    roundMap.set(row.stage, {
      ...entry,
      passed: entry.passed + (row.outcome === "passed" ? 1 : 0),
      failed: entry.failed + (row.outcome === "failed" ? 1 : 0),
    });
  }
  const roundStats = PIPELINE_FLOW.flatMap((stage) => {
    const entry = roundMap.get(stage);
    return entry ? [entry] : [];
  });

  const newLeads =
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")).get()
      ?.n ?? 0;

  return {
    statusCounts,
    activeTotal,
    overdue,
    aging,
    funnel,
    events,
    trend,
    roundStats,
    response,
    newLeads,
  };
}
