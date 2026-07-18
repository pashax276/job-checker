import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, leads, type JobRecord, type LeadRecord } from "@/db/schema";
import { duplicateKey } from "@/lib/import";
import { jobCreateSchema } from "@/lib/schemas";
import type { PostingCandidate } from "@/server/discovery/ats";
import { classifyLocation, matchedKeywords } from "@/server/discovery/filters";
import { createJob } from "@/server/jobs";

export type LeadStatus = "new" | "promoted" | "dismissed";
export type LeadSource = "ats-poll" | "alerts-rss";

export function listLeads(db: DB, status?: LeadStatus): LeadRecord[] {
  const query = db.select().from(leads);
  const rows = status
    ? query.where(eq(leads.status, status)).orderBy(desc(leads.fetchedAt)).all()
    : query.orderBy(desc(leads.fetchedAt)).all();
  return rows;
}

/**
 * Insert a lead unless its URL or its (company + title) identity already
 * exists among leads or pipeline jobs. Returns what happened.
 */
export function createLeadIfNew(
  db: DB,
  candidate: PostingCandidate,
  source: LeadSource,
  now = new Date(),
): "created" | "deduped" {
  const byUrl = db.select().from(leads).where(eq(leads.url, candidate.url)).get();
  if (byUrl) return "deduped";

  if (candidate.company) {
    const key = duplicateKey(candidate.company, candidate.title);
    const allLeads = db.select().from(leads).all();
    const leadDup = allLeads.some(
      (l) => l.company && duplicateKey(l.company, l.title) === key,
    );
    if (leadDup) return "deduped";
    const allJobs = db.select().from(jobs).all();
    const jobDup = allJobs.some(
      (j) => duplicateKey(j.company, j.role) === key,
    );
    if (jobDup) return "deduped";
  }

  db.insert(leads)
    .values({
      id: randomUUID(),
      url: candidate.url,
      title: candidate.title,
      company: candidate.company,
      source,
      atsType: candidate.atsType,
      locationClass: classifyLocation(candidate.location),
      matchedKeywords: JSON.stringify(matchedKeywords(candidate.title)),
      status: "new",
      fetchedAt: now.toISOString(),
    })
    .run();
  return "created";
}

/** Promote a lead into the pipeline: Evaluating, tier 3 - Mid, postingUrl set. */
export function promoteLead(db: DB, id: string, now = new Date()): JobRecord {
  const lead = db.select().from(leads).where(eq(leads.id, id)).get();
  if (!lead) throw new Error(`Lead ${id} not found`);
  if (lead.status === "promoted") {
    throw new Error("Lead was already promoted to the pipeline");
  }

  const company = lead.company ?? "Unknown company";
  const key = duplicateKey(company, lead.title);
  const jobDup = db
    .select()
    .from(jobs)
    .all()
    .some((j) => duplicateKey(j.company, j.role) === key);
  if (jobDup) {
    throw new Error(
      `Duplicate: ${company} — ${lead.title} already exists in the pipeline`,
    );
  }

  const job = createJob(
    db,
    jobCreateSchema.parse({
      company,
      role: lead.title,
      status: "Evaluating",
      priorityTier: "3 - Mid",
      postingUrl: lead.url,
      notes: `Promoted from discovery inbox (${lead.source}, ${lead.locationClass})`,
    }),
    now,
  );
  db.update(leads).set({ status: "promoted" }).where(eq(leads.id, id)).run();
  return job;
}

export function dismissLead(db: DB, id: string): void {
  const result = db
    .update(leads)
    .set({ status: "dismissed" })
    .where(eq(leads.id, id))
    .run();
  if (result.changes === 0) throw new Error(`Lead ${id} not found`);
}
