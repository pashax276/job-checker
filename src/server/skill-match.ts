import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs } from "@/db/schema";
import {
  computeSkillMatch,
  stripHtmlToText,
  type StoredSkillMatch,
} from "@/lib/skill-match";
import { DISCOVERY_USER_AGENT, fetchBoard } from "@/server/discovery/ats";
import { companySlugFromUrl, detectAtsType } from "@/server/discovery/rss";
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

/** The trailing path segment is each ATS's stable per-posting identifier
 * (Greenhouse's numeric id, Lever/Ashby's UUID) — comparing just that
 * avoids fragile full-URL matching across query strings/trailing slashes. */
function postingIdFromUrl(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

/**
 * Greenhouse/Lever/Ashby job pages are frequently client-rendered SPAs — a
 * plain fetch gets an empty "enable JavaScript" shell, not the posting text.
 * All three ATSes expose a public JSON board API (the same one discovery
 * polls) that includes the full description; try that first and only fall
 * back to scraping the HTML page for everything else (company career pages,
 * Workday, etc., which this app has no structured API for).
 */
async function fetchViaAtsBoard(
  postingUrl: string,
  fetchFn: typeof fetch,
): Promise<string | null> {
  const atsType = detectAtsType(postingUrl);
  if (atsType !== "greenhouse" && atsType !== "lever" && atsType !== "ashby") {
    return null;
  }
  const slug = companySlugFromUrl(postingUrl);
  if (!slug) return null;
  const targetId = postingIdFromUrl(postingUrl);
  try {
    const candidates = await fetchBoard(atsType, slug, "", fetchFn);
    const match = candidates.find(
      (c) => c.description && postingIdFromUrl(c.url) === targetId,
    );
    return match?.description ? stripHtmlToText(match.description) : null;
  } catch {
    return null; // board API unreachable/shape changed — fall back to HTML
  }
}

async function fetchPostingText(
  postingUrl: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const viaBoard = await fetchViaAtsBoard(postingUrl, fetchFn);
  if (viaBoard) return viaBoard;

  const res = await fetchFn(postingUrl, {
    headers: { "user-agent": DISCOVERY_USER_AGENT, accept: "text/html" },
  });
  if (!res.ok) {
    // 401/403 are near-always the site's bot defenses (Coinbase and
    // friends), not something retrying will fix — say so plainly instead
    // of leaving a bare status code to puzzle over.
    if ([401, 403].includes(res.status)) {
      throw new Error(
        `This posting page blocks automated fetches (${res.status}) — skill match can't read it. Paste the JD into notes instead.`,
      );
    }
    throw new Error(`Posting fetch failed (${res.status})`);
  }
  return stripHtmlToText(await res.text());
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

  const postingText = await fetchPostingText(job.postingUrl, fetchFn);
  const match: StoredSkillMatch = {
    ...computeSkillMatch(resumeSkills, postingText),
    checkedAt: now.toISOString(),
  };
  db.update(jobs)
    .set({
      skillMatch: JSON.stringify(match),
      // Snapshot the JD — postings get taken down, usually right before the
      // interview when you want to re-read them.
      jdSnapshot: postingText.slice(0, 20_000),
    })
    .where(eq(jobs.id, jobId))
    .run();
  return match;
}
