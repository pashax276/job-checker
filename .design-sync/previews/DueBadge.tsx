import { DueBadge, StatusBadge } from "job-checker";

export function Solo() {
  return <DueBadge />;
}

export function InRowContext() {
  return (
    <div className="flex w-80 items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">Stripe</span>
        <StatusBadge status="Assessment" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-data text-xs text-muted-foreground">4d</span>
        <DueBadge />
      </div>
    </div>
  );
}
