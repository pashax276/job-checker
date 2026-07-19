import { TierBadge } from "job-checker";

export function AllTiers() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TierBadge tier="1 - Top" />
      <TierBadge tier="2 - High" />
      <TierBadge tier="3 - Mid" />
      <TierBadge tier="4 - Queue" />
      <TierBadge tier="5 - Hold" />
      <TierBadge tier="Closed" />
    </div>
  );
}

export function InRowContext() {
  return (
    <div className="w-72 divide-y divide-border rounded-lg border border-border bg-card text-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium">Anthropic</span>
        <TierBadge tier="1 - Top" />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium">Vercel</span>
        <TierBadge tier="2 - High" />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium">Datadog</span>
        <TierBadge tier="4 - Queue" />
      </div>
    </div>
  );
}
