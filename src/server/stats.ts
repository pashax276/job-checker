import { and, count, eq, inArray, isNotNull, lte, not, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, leads, statusHistory } from "@/db/schema";
import {
  ACTIVE_EXCLUDED_STATUSES,
  PIPELINE_FLOW,
  STATUSES,
  type Status,
} from "@/lib/constants";
import { daysInCurrentStage, toLocalIsoDate } from "@/lib/dates";

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

export interface Stats {
  statusCounts: Record<Status, number>;
  activeTotal: number;
  overdue: OverdueItem[];
  aging: AgingItem[];
  funnel: FunnelStage[];
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

  // Conversion funnel: how far did each job ever get? Furthest stage =
  // max of (Evaluating for everyone, Applied when dateApplied exists, every
  // pipeline stage seen in history, the current stage if still in the flow).
  const allJobs = db
    .select({
      id: jobs.id,
      status: jobs.status,
      dateApplied: jobs.dateApplied,
    })
    .from(jobs)
    .all();
  const historyStages = db
    .select({ jobId: statusHistory.jobId, toStatus: statusHistory.toStatus })
    .from(statusHistory)
    .all();
  const stagesByJob = new Map<string, string[]>();
  for (const row of historyStages) {
    stagesByJob.set(row.jobId, [
      ...(stagesByJob.get(row.jobId) ?? []),
      row.toStatus,
    ]);
  }
  const flowIndex = new Map(PIPELINE_FLOW.map((s, i) => [s as string, i]));
  const appliedIndex = flowIndex.get("Applied")!;
  const reachedIndexOf = (job: (typeof allJobs)[number]): number => {
    const candidates = [0];
    if (job.dateApplied) candidates.push(appliedIndex);
    const current = flowIndex.get(job.status);
    if (current !== undefined) candidates.push(current);
    for (const stage of stagesByJob.get(job.id) ?? []) {
      const idx = flowIndex.get(stage);
      if (idx !== undefined) candidates.push(idx);
    }
    return Math.max(...candidates);
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

  const newLeads =
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")).get()
      ?.n ?? 0;

  return { statusCounts, activeTotal, overdue, aging, funnel, newLeads };
}
