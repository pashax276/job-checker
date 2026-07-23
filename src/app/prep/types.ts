import type { Status } from "@/lib/constants";
import type { PrepQuestion } from "@/lib/prep-notes";

export interface BookedStep {
  jobId: string;
  company: string;
  role: string;
  stage: Status;
  scheduledFor: string;
  prepNotes: string | null;
  questions: PrepQuestion[];
  outcome: "passed" | "failed" | null;
  status: Status;
  postingUrl: string | null;
}

export function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function countdown(iso: string, todayIso: string): string {
  const diff = Math.round(
    (new Date(`${iso}T12:00:00`).getTime() -
      new Date(`${todayIso}T12:00:00`).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1) return `in ${diff}d`;
  return `${-diff}d ago`;
}
