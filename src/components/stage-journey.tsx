"use client";

import { PIPELINE_FLOW, type Status } from "@/lib/constants";
import { daysInCurrentStage } from "@/lib/dates";
import type { StatusHistoryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_VAR: Record<Status, string> = {
  Evaluating: "var(--status-evaluating)",
  Applied: "var(--status-applied)",
  Screen: "var(--status-screen)",
  Assessment: "var(--status-assessment)",
  "HM Interview": "var(--status-hm-interview)",
  Panel: "var(--status-panel)",
  Offer: "var(--status-offer)",
  Skipped: "var(--status-skipped)",
  Rejected: "var(--status-rejected)",
};

const STAGGER_MS = 240;

// Compact labels: seven columns must fit a 24rem drawer.
const SHORT_LABEL: Record<Status, string> = {
  Evaluating: "Eval",
  Applied: "Applied",
  Screen: "Screen",
  Assessment: "Assess",
  "HM Interview": "HM",
  Panel: "Panel",
  Offer: "Offer",
  Skipped: "Skipped",
  Rejected: "Rejected",
};

interface StageJourneyProps {
  history: StatusHistoryEntry[];
  currentStatus: Status;
  /** Booked dates per stage (from stage_schedule), shown under the steps. */
  schedule?: Partial<Record<Status, string>>;
}

/** Days between two stamps (ISO datetime or date-only). */
function daysBetween(fromStamp: string, toStamp: string): number {
  return daysInCurrentStage(fromStamp, new Date(toStamp));
}

/**
 * Animated replay of a job's path from Evaluating to Offer. Each reached
 * stage pops in sequence (a "timelapse" of the process so far); terminal
 * Skipped/Rejected renders as an end chip instead of forward progress.
 */
export function StageJourney({
  history,
  currentStatus,
  schedule = {},
}: StageJourneyProps) {
  // First time each status was entered, in pipeline order of appearance.
  const enteredAt = new Map<Status, string>();
  for (const entry of history) {
    if (!enteredAt.has(entry.toStatus)) {
      enteredAt.set(entry.toStatus, entry.changedAt);
    }
  }

  const terminal =
    currentStatus === "Skipped" || currentStatus === "Rejected"
      ? currentStatus
      : null;

  // Furthest pipeline stage reached (terminal jobs: furthest before closing).
  const reachedIndices = PIPELINE_FLOW.flatMap((s, i) =>
    enteredAt.has(s) ? [i] : [],
  );
  const currentIndex = terminal
    ? (reachedIndices.at(-1) ?? 0)
    : PIPELINE_FLOW.indexOf(currentStatus);

  // Time spent per reached stage: entry -> next entry (or now for the last).
  const now = new Date().toISOString();
  const daysIn = (index: number): number | null => {
    const stamp = enteredAt.get(PIPELINE_FLOW[index]);
    if (!stamp) return null;
    const laterStamps = reachedIndices
      .filter((i) => i > index)
      .map((i) => enteredAt.get(PIPELINE_FLOW[i])!)
      .sort();
    const end =
      laterStamps[0] ??
      (terminal ? (history.at(-1)?.changedAt ?? now) : now);
    return daysBetween(stamp, end);
  };

  // Pure per-stage activity flags + cumulative step index (drives the
  // staggered replay delays without mutating state during render).
  const activeFlags = PIPELINE_FLOW.map(
    (status, i) =>
      i < currentIndex ||
      (i <= currentIndex && (enteredAt.has(status) || i === currentIndex)),
  );
  const stepOf = (i: number): number =>
    activeFlags.slice(0, i).filter(Boolean).length;
  const totalSteps = activeFlags.filter(Boolean).length;

  return (
    <div>
      <ol className="flex items-start" aria-label="Stage journey">
        {PIPELINE_FLOW.map((status, i) => {
          const active = activeFlags[i];
          const color = STATUS_VAR[status];
          const days = daysIn(i);
          const delayDot = `${stepOf(i) * STAGGER_MS}ms`;
          const delaySeg = `${(stepOf(i) + 1) * STAGGER_MS - STAGGER_MS / 2}ms`;
          return (
            <li key={status} className="flex min-w-0 flex-1 flex-col items-start">
              <span className="flex w-full items-center">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border",
                    active ? "journey-dot" : "opacity-30",
                  )}
                  style={
                    active
                      ? { background: color, borderColor: color, animationDelay: delayDot }
                      : { borderColor: "var(--border)" }
                  }
                  aria-hidden
                />
                {i < PIPELINE_FLOW.length - 1 ? (
                  <span
                    className={cn(
                      "mx-1 h-0.5 min-w-2 flex-1 rounded-full",
                      i < currentIndex ? "journey-segment" : "bg-border/60",
                    )}
                    style={
                      i < currentIndex
                        ? { background: color, animationDelay: delaySeg }
                        : undefined
                    }
                    aria-hidden
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-1 w-full truncate pr-1 text-[10px] leading-tight",
                  active ? "text-foreground/80" : "text-muted-foreground/50",
                )}
              >
                {SHORT_LABEL[status]}
              </span>
              {/* Booked dates are ground truth for when a step happened/happens;
                  fall back to days-in-stage from history stamps. */}
              {schedule[status] ? (
                <span className="font-data w-full truncate text-[10px] text-primary">
                  {schedule[status]!.slice(5).replace("-", "/")}
                </span>
              ) : active && days !== null ? (
                <span className="font-data w-full truncate text-[10px] text-muted-foreground">
                  {days}d
                </span>
              ) : null}
            </li>
          );
        })}
        {terminal ? (
          <li
            className="journey-dot ml-1 shrink-0"
            style={{ animationDelay: `${totalSteps * STAGGER_MS}ms` }}
          >
            <span
              className="inline-flex items-center rounded-sm border px-1.5 py-px font-data text-[10px]"
              style={{
                color: STATUS_VAR[terminal],
                borderColor: STATUS_VAR[terminal],
                background: "color-mix(in srgb, currentColor 10%, transparent)",
              }}
            >
              {terminal}
            </span>
          </li>
        ) : null}
      </ol>
      {history.length <= 1 ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Stage history starts at import — earlier transitions weren’t tracked.
        </p>
      ) : null}
    </div>
  );
}
