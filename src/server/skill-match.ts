import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs } from "@/db/schema";
import {
  computeSkillMatch,
  stripHtmlToText,
  type StoredSkillMatch,
} from "@/lib/skill-match";
import { DISCOVERY_USER_AGENT } from "@/server/discovery/ats";
import { getDocument, listDocuments } from "@/server/documents";

function resumeSkillsFor(db: DB, resumeId: string | null): string[] | null {
  if (resumeId) {
    const doc = getDocument(db, resumeId);
    if (doc?.kind === "resume") {
      const skills = JSON.parse(doc.skills ?? "[]") as string[];
      if (skills.length > 0) return skills;
    }
  }
  const latest = listDocuments(db, "resume")[0];
  if (latest) {
    const skills = JSON.parse(latest.skills ?? "[]") as string[];
    if (skills.length > 0) return skills;
  }
  return null;
}

/**
 * Fetch the job's posting page, extract the skills it asks for, and score
 * them against the assigned (or latest) resume. Result is stored on the job.
 */
export async function refreshSkillMatch(
  db: DB,
  jobId: string,
  fetchFn: typeof fetch = fetch,
  now = new Date(),
): Promise<StoredSkillMatch> {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (!job.postingUrl) {
    throw new Error("This job has no posting URL to compare against");
  }
  const url = new URL(job.postingUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Posting URL must be http(s)");
  }

  const resumeSkills = resumeSkillsFor(db, job.resumeId);
  if (!resumeSkills) {
    throw new Error("Upload a resume with skills first (Resumes page)");
  }

  const res = await fetchFn(job.postingUrl, {
    headers: { "user-agent": DISCOVERY_USER_AGENT, accept: "text/html" },
  });
  if (!res.ok) throw new Error(`Posting fetch failed (${res.status})`);

  const match: StoredSkillMatch = {
    ...computeSkillMatch(resumeSkills, stripHtmlToText(await res.text())),
    checkedAt: now.toISOString(),
  };
  db.update(jobs)
    .set({ skillMatch: JSON.stringify(match) })
    .where(eq(jobs.id, jobId))
    .run();
  return match;
}
