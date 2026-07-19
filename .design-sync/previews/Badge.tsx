import { Badge } from "job-checker";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Offer</Badge>
      <Badge variant="secondary">Remote</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="outline">Full-time</Badge>
      <Badge variant="ghost">Archived</Badge>
      <Badge variant="link">greenhouse.io</Badge>
    </div>
  );
}

export function OnJobCard() {
  return (
    <div className="w-80 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Senior Platform Engineer</span>
        <Badge>Offer</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Anthropic — San Francisco, CA
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary">Remote</Badge>
        <Badge variant="outline">Full-time</Badge>
        <Badge variant="outline">$210k–$260k</Badge>
      </div>
    </div>
  );
}
