import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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
  compBase: text("comp_base"),
  compBonus: text("comp_bonus"),
  compEquity: text("comp_equity"),
  resumeId: text("resume_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  coverLetterId: text("cover_letter_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Uploaded resumes / cover letters: file on the /data volume, extracted text
// + parsed bullets/skills in the row. Assigned to jobs via jobs.resumeId /
// jobs.coverLetterId (tailored versions per application).
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // 'resume' | 'cover-letter'
  name: text("name").notNull(), // version label, e.g. "v3-platform"
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  extractedText: text("extracted_text").notNull().default(""),
  bullets: text("bullets"), // JSON string[]
  skills: text("skills"), // JSON string[]
  createdAt: text("created_at").notNull(),
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
  phone: text("phone"),
  lastTouch: text("last_touch"),
  createdAt: text("created_at").notNull(),
});

// When an upcoming step (screen/HM/panel/…) is booked: one date per stage.
export const stageSchedule = sqliteTable(
  "stage_schedule",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
  },
  (t) => [unique().on(t.jobId, t.stage)],
);

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
export type StageScheduleRecord = typeof stageSchedule.$inferSelect;
export type DocumentRecord = typeof documents.$inferSelect;
export type WatchlistRecord = typeof watchlist.$inferSelect;
export type LeadRecord = typeof leads.$inferSelect;
