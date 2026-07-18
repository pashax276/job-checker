import type { Status, Tier } from "@/lib/constants";

/** Client-side job shape (mirrors the jobs table; no drizzle imports). */
export interface Job {
  id: string;
  company: string;
  role: string;
  priorityTier: Tier;
  status: Status;
  dateApplied: string | null;
  compNotes: string | null;
  nextAction: string | null;
  followUpDate: string | null;
  contact: string | null;
  notes: string | null;
  postingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  jobId: string;
  fromStatus: Status | null;
  toStatus: Status;
  changedAt: string;
}

export interface JobDetail extends Job {
  statusHistory: StatusHistoryEntry[];
}

export interface OverdueItem {
  id: string;
  company: string;
  role: string;
  status: Status;
  followUpDate: string;
  nextAction: string | null;
}

export interface AgingItem {
  id: string;
  company: string;
  role: string;
  status: Status;
  daysInCurrentStage: number;
}

export interface Stats {
  statusCounts: Record<Status, number>;
  activeTotal: number;
  overdue: OverdueItem[];
  aging: AgingItem[];
  newLeads: number;
}

export interface JobsQuery {
  status?: Status;
  tier?: Tier;
  q?: string;
  dueOnly?: boolean;
}
