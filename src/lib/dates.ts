const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC off-by-one). */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days between application date and today; null when never applied. */
export function daysSinceApplied(
  dateApplied: string | null,
  today: Date,
): number | null {
  if (!dateApplied) return null;
  const diff =
    startOfLocalDay(today).getTime() - parseLocalDate(dateApplied).getTime();
  // round (not floor) so DST-shifted 23/25-hour days still count as whole days
  return Math.round(diff / MS_PER_DAY);
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days since the last status change; clamped at 0 for future stamps.
 * Accepts full ISO timestamps and date-only strings (parsed as local dates —
 * new Date("YYYY-MM-DD") would read them as UTC midnight, off by one day). */
export function daysInCurrentStage(
  lastStatusChangeAt: string,
  today: Date,
): number {
  const changed = startOfLocalDay(
    DATE_ONLY_RE.test(lastStatusChangeAt)
      ? parseLocalDate(lastStatusChangeAt)
      : new Date(lastStatusChangeAt),
  );
  const diff = startOfLocalDay(today).getTime() - changed.getTime();
  return Math.max(0, Math.round(diff / MS_PER_DAY));
}

/** Format a Date as local YYYY-MM-DD (for lexicographic SQL comparison). */
export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when a follow-up date exists and is today or earlier. */
export function isFollowUpDue(followUpDate: string | null, today: Date): boolean {
  if (!followUpDate) return false;
  return (
    parseLocalDate(followUpDate).getTime() <= startOfLocalDay(today).getTime()
  );
}
