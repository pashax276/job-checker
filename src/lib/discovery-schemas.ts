import { z } from "zod";

export const ATS_TYPES = ["greenhouse", "lever", "ashby"] as const;

export const watchlistCreateSchema = z.strictObject({
  displayName: z.string().trim().min(1, "Company name is required"),
  atsType: z.enum(ATS_TYPES),
  boardSlug: z.string().trim().min(1, "Board slug is required"),
  enabled: z.boolean().default(true),
});

export const watchlistPatchSchema = z.strictObject({
  displayName: z.string().trim().min(1).optional(),
  atsType: z.enum(ATS_TYPES).optional(),
  boardSlug: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
});

export const alertQuerySchema = z.strictObject({
  label: z.string().trim().min(1),
  query: z.string().trim().min(1),
});

export const settingsPutSchema = z.strictObject({
  rssFeeds: z.array(z.url()).optional(),
  profileBlurb: z.string().optional(),
  alertQueries: z.array(alertQuerySchema).optional(),
});

export type AlertQuery = z.output<typeof alertQuerySchema>;

/**
 * The owner's saved search recipes. The app never runs these against Google —
 * they exist to create/maintain Google Alerts ("Deliver to: RSS feed") whose
 * feeds the app polls.
 */
const QUERY_BODY =
  '("Senior Platform Engineer" OR "Senior DevOps Engineer" OR "Site Reliability Engineer" OR "Staff Platform Engineer" OR "Staff DevOps Engineer") AWS -Junior -"Entry Level" -Intern';

export const DEFAULT_ALERT_QUERIES: AlertQuery[] = [
  { label: "Greenhouse", query: `site:boards.greenhouse.io ${QUERY_BODY}` },
  { label: "Lever", query: `site:jobs.lever.co ${QUERY_BODY}` },
  { label: "Ashby", query: `site:jobs.ashbyhq.com ${QUERY_BODY}` },
  { label: "Workday", query: `site:myworkdayjobs.com ${QUERY_BODY}` },
];

export const leadActionSchema = z.strictObject({
  action: z.enum(["promote", "dismiss"]),
});

export type WatchlistCreate = z.output<typeof watchlistCreateSchema>;
export type WatchlistPatch = z.output<typeof watchlistPatchSchema>;
