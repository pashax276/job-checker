import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, leads } from "@/db/schema";
import {
  buildCoverLetterPrompt,
  buildFitPrompt,
  buildFollowUpPrompt,
  buildPrepPrompt,
} from "@/lib/ai-prompts";
import { daysSinceApplied } from "@/lib/dates";
import type { ExperienceEntry } from "@/lib/resume-parse";
import { parseStoredSkillMatch, stripHtmlToText } from "@/lib/skill-match";
import { listContacts } from "@/server/contacts";
import { DISCOVERY_USER_AGENT } from "@/server/discovery/ats";
import { getDocument, listDocuments } from "@/server/documents";
import { getSetting } from "@/server/settings";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL ?? "claude-sonnet-5";
}

export type CompleteFn = (prompt: string) => Promise<string>;

async function defaultComplete(prompt: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const message = await client.messages.create({
    model: aiModel(),
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
}

function requireAi(): void {
  if (!aiEnabled()) {
    throw new Error(
      "AI features are off — set ANTHROPIC_API_KEY to enable them",
    );
  }
}

interface ResumeContext {
  bullets: string[];
  skills: string[];
  experience: ExperienceEntry[];
}

function resumeContext(db: DB, resumeId: string | null): ResumeContext {
  const doc =
    (resumeId ? getDocument(db, resumeId) : null) ??
    listDocuments(db, "resume")[0] ??
    null;
  if (!doc) return { bullets: [], skills: [], experience: [] };
  return {
    bullets: JSON.parse(doc.bullets ?? "[]") as string[],
    skills: JSON.parse(doc.skills ?? "[]") as string[],
    experience: JSON.parse(doc.experience ?? "[]") as ExperienceEntry[],
  };
}

function getJobRow(db: DB, jobId: string) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) throw new Error(`Job ${jobId} not found`);
  return job;
}

export async function generatePrepQuestions(
  db: DB,
  jobId: string,
  stage: string,
  complete: CompleteFn = defaultComplete,
): Promise<string> {
  requireAi();
  const job = getJobRow(db, jobId);
  const resume = resumeContext(db, job.resumeId);
  const match = parseStoredSkillMatch(job.skillMatch);
  return complete(
    buildPrepPrompt({
      company: job.company,
      role: job.role,
      stage,
      jdText: job.jdSnapshot,
      resumeBullets: resume.bullets,
      missingSkills: match?.missing ?? [],
    }),
  );
}

export async function draftFollowUp(
  db: DB,
  jobId: string,
  complete: CompleteFn = defaultComplete,
): Promise<string> {
  requireAi();
  const job = getJobRow(db, jobId);
  const contact = listContacts(db, jobId)[0] ?? null;
  return complete(
    buildFollowUpPrompt({
      company: job.company,
      role: job.role,
      status: job.status,
      contactName: contact?.name.split(" ")[0] ?? null,
      daysSinceApplied: daysSinceApplied(job.dateApplied, new Date()),
      nextAction: job.nextAction,
    }),
  );
}

export async function draftCoverLetter(
  db: DB,
  jobId: string,
  complete: CompleteFn = defaultComplete,
): Promise<string> {
  requireAi();
  const job = getJobRow(db, jobId);
  const resume = resumeContext(db, job.coverLetterId ?? job.resumeId);
  return complete(
    buildCoverLetterPrompt({
      company: job.company,
      role: job.role,
      jdText: job.jdSnapshot,
      resumeBullets: resume.bullets,
      experience: resume.experience,
    }),
  );
}

export async function assessLeadFit(
  db: DB,
  leadId: string,
  complete: CompleteFn = defaultComplete,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  requireAi();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const res = await fetchFn(lead.url, {
    headers: { "user-agent": DISCOVERY_USER_AGENT, accept: "text/html" },
  });
  if (!res.ok) throw new Error(`Posting fetch failed (${res.status})`);

  const resume = resumeContext(db, null);
  const summary = await complete(
    buildFitPrompt({
      title: lead.title,
      company: lead.company,
      postingText: stripHtmlToText(await res.text()),
      profileBlurb: getSetting<string>(db, "profileBlurb") ?? "",
      resumeSkills: resume.skills,
    }),
  );
  db.update(leads)
    .set({ fitSummary: summary })
    .where(eq(leads.id, leadId))
    .run();
  return summary;
}
