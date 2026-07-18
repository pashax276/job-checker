import { isFollowUpDue, toLocalIsoDate } from "@/lib/dates";
import type { Job } from "@/lib/types";

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * All-day VEVENT per job whose follow-up is today or later.
 * RFC 5545 requires CRLF line endings.
 */
export function buildFollowUpCalendar(jobs: Job[], today = new Date()): string {
  const todayIso = toLocalIsoDate(today);
  const upcoming = jobs.filter(
    (j) => j.followUpDate !== null && j.followUpDate >= todayIso,
  );

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//job-tracker//follow-ups//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const job of upcoming) {
    const date = job.followUpDate!.replaceAll("-", "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${job.id}@job-tracker`,
      `DTSTAMP:${todayIso.replaceAll("-", "")}T000000Z`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeText(`Follow up: ${job.company} — ${job.role}`)}`,
      ...(job.nextAction
        ? [`DESCRIPTION:${escapeText(job.nextAction)}`]
        : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// re-export for callers that also need due checks alongside calendar export
export { isFollowUpDue };
