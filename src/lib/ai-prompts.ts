import type { ExperienceEntry } from "@/lib/resume-parse";

const JD_CAP = 8_000;

const cap = (text: string): string => text.slice(0, JD_CAP);

export interface PrepPromptInput {
  company: string;
  role: string;
  stage: string;
  jdText: string | null;
  resumeBullets: string[];
  missingSkills: string[];
}

export function buildPrepPrompt(input: PrepPromptInput): string {
  return [
    `I have a "${input.stage}" interview coming up for the ${input.role} role at ${input.company}.`,
    input.jdText
      ? `Job description (excerpt):\n${cap(input.jdText)}`
      : "No job description available — infer from the role title.",
    input.resumeBullets.length > 0
      ? `My resume highlights:\n${input.resumeBullets.map((b) => `- ${b}`).join("\n")}`
      : "",
    input.missingSkills.length > 0
      ? `Skills the JD asks for that my resume does not mention: ${input.missingSkills.join(", ")} — probe these, I need to prepare answers.`
      : "",
    "Write: (1) the 8 most likely interview questions for this round, hardest first, each with a one-line pointer on how I should angle my answer given my background; (2) 3 sharp questions I should ask them. Plain text, no markdown headers.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface FollowUpPromptInput {
  company: string;
  role: string;
  status: string;
  contactName: string | null;
  daysSinceApplied: number | null;
  nextAction: string | null;
}

export function buildFollowUpPrompt(input: FollowUpPromptInput): string {
  return [
    `Draft a short, professional follow-up email for my job application.`,
    `Role: ${input.role} at ${input.company}. Current stage: ${input.status}.`,
    input.contactName ? `Addressed to: ${input.contactName}.` : "No named contact — use a neutral greeting.",
    input.daysSinceApplied !== null
      ? `I applied ${input.daysSinceApplied} days ago.`
      : "",
    input.nextAction ? `My tracker's next-action note: ${input.nextAction}` : "",
    'Under 120 words, confident but not pushy, sign off as "Pavlo". Format: first line "Subject: …", blank line, then the body. No markdown.',
  ]
    .filter(Boolean)
    .join("\n");
}

export interface FitPromptInput {
  title: string;
  company: string | null;
  postingText: string;
  profileBlurb: string;
  resumeSkills: string[];
}

export function buildFitPrompt(input: FitPromptInput): string {
  return [
    `Assess how well this job posting fits me.`,
    `Posting: ${input.title}${input.company ? ` at ${input.company}` : ""}.`,
    `Posting text (excerpt):\n${cap(input.postingText)}`,
    input.profileBlurb ? `My profile: ${input.profileBlurb}` : "",
    input.resumeSkills.length > 0
      ? `My skills: ${input.resumeSkills.join(", ")}`
      : "",
    "Reply with exactly: a verdict line 'Fit: Strong|Moderate|Weak', then 3 short sentences — why it fits, the biggest gap, and one thing to emphasize if I apply. No markdown.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface CoverLetterPromptInput {
  company: string;
  role: string;
  jdText: string | null;
  resumeBullets: string[];
  experience: ExperienceEntry[];
}

export function buildCoverLetterPrompt(input: CoverLetterPromptInput): string {
  return [
    `Write a cover letter for the ${input.role} role at ${input.company}.`,
    input.jdText ? `Job description (excerpt):\n${cap(input.jdText)}` : "",
    input.experience.length > 0
      ? `My experience:\n${input.experience
          .map((e) => `- ${e.company}: ${e.title} (${e.period})`)
          .join("\n")}`
      : "",
    input.resumeBullets.length > 0
      ? `Resume highlights:\n${input.resumeBullets.map((b) => `- ${b}`).join("\n")}`
      : "",
    'About 250 words, specific over generic, no clichés ("passionate", "team player"), grounded in my actual experience, sign as "Pavlo Lisnykov". Plain text.',
  ]
    .filter(Boolean)
    .join("\n\n");
}
