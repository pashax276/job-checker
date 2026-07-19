import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, statusHistory } from "@/db/schema";
import {
  ACTIVE_EXCLUDED_STATUSES,
  type Status,
} from "@/lib/constants";
import { daysInCurrentStage } from "@/lib/dates";
import { getSetting, setSetting } from "@/server/settings";

export type ReminderRule = "no-reply" | "thank-you" | "stale-evaluating";

export interface Reminder {
  key: string;
  rule: ReminderRule;
  jobId: string;
  company: string;
  role: string;
  status: Status;
  message: string;
}

const DISMISSED_KEY = "dismissedReminders";
const NO_REPLY_DAYS = 7;
const THANK_YOU_WINDOW_DAYS = 2;
const STALE_EVALUATING_DAYS = 14;
const THANK_YOU_STAGES: readonly Status[] = ["Screen", "HM Interview", "Panel"];

/**
 * Rule-derived reminders — computed on read, never stored, so they stay in
 * sync with the pipeline for free. Dismissals persist as keys in settings.
 */
export function computeReminders(db: DB, today = new Date()): Reminder[] {
  const dismissed = new Set(getSetting<string[]>(db, DISMISSED_KEY) ?? []);
  const reminders: Reminder[] = [];

  const activeJobs = db
    .select()
    .from(jobs)
    .all()
    .filter(
      (j) =>
        j.priorityTier !== "Closed" &&
        !ACTIVE_EXCLUDED_STATUSES.includes(j.status as Status),
    );

  for (const job of activeJobs) {
    const status = job.status as Status;

    if (status === "Applied" && !job.followUpDate) {
      const since = job.dateApplied ?? job.createdAt;
      const days = daysInCurrentStage(since, today);
      if (days >= NO_REPLY_DAYS) {
        reminders.push({
          key: `no-reply:${job.id}`,
          rule: "no-reply",
          jobId: job.id,
          company: job.company,
          role: job.role,
          status,
          message: `No reply ${days} days after applying — nudge or set a follow-up date`,
        });
      }
    }

    if (THANK_YOU_STAGES.includes(status)) {
      // Only a real transition counts — the seed-import row (fromStatus null)
      // says nothing about when the stage actually started.
      const latest = db
        .select()
        .from(statusHistory)
        .where(eq(statusHistory.jobId, job.id))
        .orderBy(desc(statusHistory.changedAt))
        .limit(1)
        .get();
      if (
        latest &&
        latest.fromStatus !== null &&
        latest.toStatus === status &&
        daysInCurrentStage(latest.changedAt, today) <= THANK_YOU_WINDOW_DAYS
      ) {
        reminders.push({
          key: `thank-you:${job.id}:${latest.changedAt.slice(0, 10)}`,
          rule: "thank-you",
          jobId: job.id,
          company: job.company,
          role: job.role,
          status,
          message: `Entered ${status} — send a thank-you / recap note`,
        });
      }
    }

    if (status === "Evaluating") {
      const days = daysInCurrentStage(job.createdAt, today);
      if (days >= STALE_EVALUATING_DAYS) {
        reminders.push({
          key: `stale-evaluating:${job.id}`,
          rule: "stale-evaluating",
          jobId: job.id,
          company: job.company,
          role: job.role,
          status,
          message: `Evaluating for ${days} days — apply or move it to Skipped`,
        });
      }
    }
  }

  return reminders.filter((r) => !dismissed.has(r.key));
}

export function dismissReminder(db: DB, key: string): void {
  const dismissed = getSetting<string[]>(db, DISMISSED_KEY) ?? [];
  if (!dismissed.includes(key)) {
    setSetting(db, DISMISSED_KEY, [...dismissed, key]);
  }
}
