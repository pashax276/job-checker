import { extractSkills } from "@/lib/resume-parse";

export interface SkillMatchResult {
  /** matched / jd skills; 0 when the JD has no recognizable skills. */
  score: number;
  matched: string[];
  missing: string[];
}

export interface StoredSkillMatch extends SkillMatchResult {
  checkedAt: string;
}

/** Plain text from a posting page: scripts/styles dropped, tags stripped. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dictionary skills the JD asks for vs. what the resume covers. */
export function computeSkillMatch(
  resumeSkills: string[],
  postingText: string,
): SkillMatchResult {
  const jdSkills = extractSkills(postingText);
  if (jdSkills.length === 0) return { score: 0, matched: [], missing: [] };
  const resumeSet = new Set(resumeSkills.map((s) => s.toLowerCase()));
  const matched = jdSkills.filter((s) => resumeSet.has(s.toLowerCase()));
  const missing = jdSkills.filter((s) => !resumeSet.has(s.toLowerCase()));
  return { score: matched.length / jdSkills.length, matched, missing };
}

export function parseStoredSkillMatch(
  raw: string | null,
): StoredSkillMatch | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSkillMatch;
  } catch {
    return null;
  }
}
