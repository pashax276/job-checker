import { StatusBadge } from "job-checker";

export function AllStatuses() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <StatusBadge status="Evaluating" />
      <StatusBadge status="Applied" />
      <StatusBadge status="Screen" />
      <StatusBadge status="Assessment" />
      <StatusBadge status="Panel" />
      <StatusBadge status="Offer" />
      <StatusBadge status="Skipped" />
      <StatusBadge status="Rejected" />
    </div>
  );
}

export function InRowContext() {
  return (
    <div className="w-72 divide-y divide-border rounded-lg border border-border bg-card text-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium">Anthropic</span>
        <StatusBadge status="Panel" />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium">Vercel</span>
        <StatusBadge status="Applied" />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium">Linear</span>
        <StatusBadge status="Screen" />
      </div>
    </div>
  );
}
