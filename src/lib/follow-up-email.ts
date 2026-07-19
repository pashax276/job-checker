import { daysSinceApplied } from "@/lib/dates";
import type { Job } from "@/lib/types";

export interface FollowUpEmailDraft {
  subject: string;
  body: string;
}

const SIGN_OFF = "Best regards,\nPavlo";

function daysPhrase(job: Job, today: Date): string {
  const days = daysSinceApplied(job.dateApplied, today);
  if (days === null) return "recently";
  if (days >= 13 && days <= 15) return "about two weeks ago";
  if (days >= 6 && days <= 8) return "about a week ago";
  return `${days} days ago`;
}

/**
 * A copy-paste follow-up email matched to where the job stands. Deliberately
 * short and unadorned — the point is a solid starting draft, not automation.
 */
export function followUpEmail(
  job: Job,
  contactName: string | null,
  today = new Date(),
): FollowUpEmailDraft {
  const greeting = `Hi ${contactName ?? "there"},`;
  const role = job.role;
  const company = job.company;

  switch (job.status) {
    case "Evaluating":
      return {
        subject: `Interest in the ${role} role`,
        body: `${greeting}\n\nI came across the ${role} opening at ${company} and I'm very interested — the scope looks like a strong match for my platform/SRE background. Before applying, I wanted to ask whether the role is still open and if there's anything beyond the posting I should know about the team's priorities.\n\nHappy to share my resume and more context.\n\n${SIGN_OFF}`,
      };
    case "Applied":
      return {
        subject: `Following up on my ${role} application`,
        body: `${greeting}\n\nI applied for the ${role} position at ${company} ${daysPhrase(job, today)} and wanted to check in on where things stand. I remain very interested in the role and would welcome the chance to talk about how my experience maps to the team's needs.\n\nIs there any update on the process, or anything further you need from me?\n\n${SIGN_OFF}`,
      };
    case "Screen":
    case "Assessment":
    case "HM Interview":
    case "Panel": {
      const round =
        job.status === "Screen"
          ? "screening conversation"
          : job.status === "Assessment"
            ? "assessment"
            : job.status === "HM Interview"
              ? "conversation with the hiring manager"
              : "panel interview";
      return {
        subject: `Thank you — ${role} ${job.status.toLowerCase()}`,
        body: `${greeting}\n\nThank you for the ${round} for the ${role} role at ${company} — I enjoyed the discussion and left even more excited about the work. If any follow-up questions came up on your side, I'm glad to expand on anything we covered.\n\nLooking forward to the next steps.\n\n${SIGN_OFF}`,
      };
    }
    case "Offer":
      return {
        subject: `Re: ${role} offer`,
        body: `${greeting}\n\nThank you again for the offer for the ${role} role — I'm genuinely excited about joining ${company}. Could you share the full details in writing along with the timeline you're working toward? I want to give it proper attention and come back to you promptly.\n\n${SIGN_OFF}`,
      };
    default:
      return {
        subject: `Thank you — ${role} at ${company}`,
        body: `${greeting}\n\nThank you for the time and consideration during the process for the ${role} role. I'd be glad to stay in touch — if a similar opening comes up at ${company}, I'd welcome the chance to talk again.\n\n${SIGN_OFF}`,
      };
  }
}
