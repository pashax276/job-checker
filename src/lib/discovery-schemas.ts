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

export const settingsPutSchema = z.strictObject({
  rssFeeds: z.array(z.url()).optional(),
  profileBlurb: z.string().optional(),
});

export const leadActionSchema = z.strictObject({
  action: z.enum(["promote", "dismiss"]),
});

export type WatchlistCreate = z.output<typeof watchlistCreateSchema>;
export type WatchlistPatch = z.output<typeof watchlistPatchSchema>;
