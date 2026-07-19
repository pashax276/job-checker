import { toLocalIsoDate } from "@/lib/dates";
import type { Job } from "@/lib/types";

export interface ScheduledStepEvent {
  jobId: string;
  company: string;
  role: string;
  stage: string;
  scheduledFor: string;
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * The tracker's calendar feed: every booked interview step (past included —
 * calendar apps show history fine) plus upcoming follow-ups, as all-day
 * events. Subscribe a calendar app to /api/export/ics and interviews appear
 * automatically. RFC 5545 requires CRLF line endings.
 */
export function buildTrackerCalendar(
  jobs: Job[],
  steps: ScheduledStepEvent[],
  today = new Date(),
): string {
  const todayIso = toLocalIsoDate(today);
  const stamp = `${todayIso.replaceAll("-", "")}T000000Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//job-tracker//calendar//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Job Pipeline",
  ];

  for (const step of steps) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${step.jobId}-${slugify(step.stage)}@job-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${step.scheduledFor.replaceAll("-", "")}`,
      `SUMMARY:${escapeText(`${step.stage}: ${step.company} — ${step.role}`)}`,
      "END:VEVENT",
    );
  }

  const upcoming = jobs.filter(
    (j) => j.followUpDate !== null && j.followUpDate >= todayIso,
  );
  for (const job of upcoming) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${job.id}@job-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${job.followUpDate!.replaceAll("-", "")}`,
      `SUMMARY:${escapeText(`Follow up: ${job.company} — ${job.role}`)}`,
      ...(job.nextAction ? [`DESCRIPTION:${escapeText(job.nextAction)}`] : []),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
