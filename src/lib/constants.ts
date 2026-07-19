export const STATUSES = [
  "Evaluating",
  "Applied",
  "Screen",
  "Assessment",
  "HM Interview",
  "Panel",
  "Offer",
  "Skipped",
  "Rejected",
] as const;

export const TIERS = [
  "1 - Top",
  "2 - High",
  "3 - Mid",
  "4 - Queue",
  "5 - Hold",
  "Closed",
] as const;

export type Status = (typeof STATUSES)[number];
export type Tier = (typeof TIERS)[number];

export const DEFAULT_STATUS: Status = "Evaluating";
export const DEFAULT_TIER: Tier = "3 - Mid";

// Statuses excluded from the "active pipeline" count (tier must also not be Closed).
export const ACTIVE_EXCLUDED_STATUSES: readonly Status[] = ["Skipped", "Rejected"];

// Forward path through the pipeline (excludes the terminal Skipped/Rejected).
export const PIPELINE_FLOW: readonly Status[] = [
  "Evaluating",
  "Applied",
  "Screen",
  "Assessment",
  "HM Interview",
  "Panel",
  "Offer",
];

// The "in interview loops" subset for dashboard summary counts.
export const LOOP_STATUSES: readonly Status[] = [
  "Screen",
  "Assessment",
  "HM Interview",
  "Panel",
];

// Column order of the original Excel tracker. Export must emit exactly this
// order; import accepts files with these headers.
export const TRACKER_COLUMNS = [
  "Company",
  "Role",
  "Priority Tier",
  "Status",
  "Date Applied",
  "Comp Notes",
  "Next Action",
  "Follow-Up Date",
  "Contact",
  "Notes",
  "Posting URL",
] as const;
