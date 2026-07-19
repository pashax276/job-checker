import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  priorityTier: text("priority_tier").notNull().default("3 - Mid"),
  status: text("status").notNull().default("Evaluating"),
  dateApplied: text("date_applied"),
  compNotes: text("comp_notes"),
  nextAction: text("next_action"),
  followUpDate: text("follow_up_date"),
  contact: text("contact"),
  notes: text("notes"),
  postingUrl: text("posting_url"),
  resumeVersion: text("resume_version"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Structured contacts per job (the legacy jobs.contact text stays as-is).
export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  lastTouch: text("last_touch"),
  createdAt: text("created_at").notNull(),
});

// Free-text activity log per job, merged with status history in the drawer.
export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

export const statusHistory = sqliteTable("status_history", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: text("changed_at").notNull(),
});

export const watchlist = sqliteTable("watchlist", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  atsType: text("ats_type").notNull(),
  boardSlug: text("board_slug").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  company: text("company"),
  source: text("source").notNull(),
  atsType: text("ats_type"),
  locationClass: text("location_class").notNull(),
  matchedKeywords: text("matched_keywords"),
  status: text("status").notNull().default("new"),
  fetchedAt: text("fetched_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type JobRecord = typeof jobs.$inferSelect;
export type StatusHistoryRecord = typeof statusHistory.$inferSelect;
export type ContactRecord = typeof contacts.$inferSelect;
export type ActivityRecord = typeof activity.$inferSelect;
export type WatchlistRecord = typeof watchlist.$inferSelect;
export type LeadRecord = typeof leads.$inferSelect;
