import { parseStoredSkillMatch } from "@/lib/skill-match";
import type { Job } from "@/lib/types";

/**
 * Every skill that's shown up as matched-or-missing across jobs that have
 * been skill-matched at least once — the shared universe each resume's
 * coverage is measured against on the Resumes page (List/Split badges and
 * the Coverage matrix). Jobs never checked contribute nothing; there's no
 * signal from them yet.
 */
export function computeSkillUniverse(jobs: Job[]): string[] {
  const set = new Set<string>();
  for (const job of jobs) {
    const match = parseStoredSkillMatch(job.skillMatch);
    if (!match) continue;
    for (const s of match.matched) set.add(s);
    for (const s of match.missing) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface ResumeCoverage {
  covered: number;
  total: number;
}

export function resumeCoverage(
  resumeSkills: string[],
  universe: string[],
): ResumeCoverage {
  const resumeSet = new Set(resumeSkills.map((s) => s.toLowerCase()));
  const covered = universe.filter((s) =>
    resumeSet.has(s.toLowerCase()),
  ).length;
  return { covered, total: universe.length };
}
