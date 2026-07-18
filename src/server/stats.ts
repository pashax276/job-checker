import { and, count, eq, inArray, isNotNull, lte, not, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, leads, statusHistory } from "@/db/schema";
import {
  ACTIVE_EXCLUDED_STATUSES,
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

export interface Stats {
  statusCounts: Record<Status, number>;
  activeTotal: number;
  overdue: OverdueItem[];
  aging: AgingItem[];
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
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(activeCondition())
    .all();
  const lastChanges = db
    .select({
      jobId: statusHistory.jobId,
      last: sql<string>`MAX(${statusHistory.changedAt})`,
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
  const lastByJob = new Map(lastChanges.map((r) => [r.jobId, r.last]));

  const aging: AgingItem[] = activeJobs
    .map((j) => ({
      id: j.id,
      company: j.company,
      role: j.role,
      status: j.status,
      daysInCurrentStage: daysInCurrentStage(
        lastByJob.get(j.id) ?? j.createdAt,
        today,
      ),
    }))
    .sort((a, b) => b.daysInCurrentStage - a.daysInCurrentStage);

  const newLeads =
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")).get()
      ?.n ?? 0;

  return { statusCounts, activeTotal, overdue, aging, newLeads };
}
