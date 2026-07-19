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
  resumeVersion: string | null;
  compBase: string | null;
  compBonus: string | null;
  compEquity: string | null;
  resumeId: string | null;
  coverLetterId: string | null;
  source: "manual" | "import" | "discovery";
  skillMatch: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMeta {
  id: string;
  kind: "resume" | "cover-letter";
  name: string;
  fileName: string;
  mimeType: string;
  bullets: string[];
  skills: string[];
  createdAt: string;
}

export interface Contact {
  id: string;
  jobId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  lastTouch: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  jobId: string;
  note: string;
  createdAt: string;
}

export interface Reminder {
  key: string;
  rule: "no-reply" | "thank-you" | "stale-evaluating";
  jobId: string;
  company: string;
  role: string;
  status: Status;
  message: string;
}

export interface StatusHistoryEntry {
  id: string;
  jobId: string;
  fromStatus: Status | null;
  toStatus: Status;
  changedAt: string;
}

export interface StageScheduleEntry {
  id: string;
  jobId: string;
  stage: Status;
  scheduledFor: string;
  prepNotes: string | null;
}

export interface JobDetail extends Job {
  statusHistory: StatusHistoryEntry[];
  contacts: Contact[];
  activityLog: ActivityEntry[];
  schedule: StageScheduleEntry[];
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

export interface FunnelStage {
  status: Status;
  reached: number;
  conversion: number | null;
}

export interface CalendarEvent {
  date: string;
  jobId: string;
  company: string;
  kind: string;
}

export interface Stats {
  statusCounts: Record<Status, number>;
  activeTotal: number;
  overdue: OverdueItem[];
  aging: AgingItem[];
  funnel: FunnelStage[];
  events: CalendarEvent[];
  newLeads: number;
}

export interface JobsQuery {
  status?: Status;
  tier?: Tier;
  q?: string;
  dueOnly?: boolean;
}
