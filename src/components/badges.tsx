import { FileDown, PenLine, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Status, Tier } from "@/lib/constants";
import type { JobSource } from "@/lib/types";

const TIER_CLASSES: Record<Tier, string> = {
  "1 - Top": "text-tier-1 bg-tier-1/10 border-tier-1/30",
  "2 - High": "text-tier-2 bg-tier-2/10 border-tier-2/30",
  "3 - Mid": "text-tier-3 bg-tier-3/10 border-tier-3/30",
  "4 - Queue": "text-tier-4 bg-tier-4/10 border-tier-4/30",
  "5 - Hold": "text-tier-5 bg-tier-5/10 border-tier-5/30",
  Closed: "text-tier-closed bg-tier-closed/10 border-tier-closed/30",
};

const STATUS_DOT_CLASSES: Record<Status, string> = {
  Evaluating: "bg-status-evaluating",
  Applied: "bg-status-applied",
  Screen: "bg-status-screen",
  Assessment: "bg-status-assessment",
  "HM Interview": "bg-status-hm-interview",
  Panel: "bg-status-panel",
  Offer: "bg-status-offer",
  Skipped: "bg-status-skipped",
  Rejected: "bg-status-rejected",
};

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-px font-data text-[11px] leading-4 whitespace-nowrap",
        TIER_CLASSES[tier],
        className,
      )}
    >
      {tier}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-foreground/90 whitespace-nowrap",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[status])}
      />
      {status}
    </span>
  );
}

const SOURCE_META: Record<
  JobSource,
  { Icon: typeof Radar; label: string; className: string }
> = {
  discovery: {
    Icon: Radar,
    label: "Found by Run discovery",
    className: "text-primary/70",
  },
  import: {
    Icon: FileDown,
    label: "Imported from a tracker file",
    className: "text-muted-foreground/70",
  },
  manual: {
    Icon: PenLine,
    label: "Added manually",
    className: "text-muted-foreground/50",
  },
};

/**
 * How a job got into the tracker, as one consistent icon everywhere it's
 * shown. Manual gets an icon too — leaving it blank made "added by hand"
 * indistinguishable from "this view forgot to render the indicator".
 */
export function SourceIcon({
  source,
  className,
}: {
  source: JobSource;
  className?: string;
}) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual;
  const { Icon } = meta;
  return (
    <Icon
      role="img"
      aria-label={meta.label}
      className={cn("size-3 shrink-0", meta.className, className)}
    >
      <title>{meta.label}</title>
    </Icon>
  );
}

export function DueBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-due/15 border border-due/40 px-1.5 py-px font-data text-[11px] font-medium leading-4 text-due",
        className,
      )}
    >
      DUE
    </span>
  );
}
