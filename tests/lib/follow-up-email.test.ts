import { describe, expect, it } from "vitest";
import { followUpEmail } from "@/lib/follow-up-email";
import type { Job } from "@/lib/types";

const TODAY = new Date(2026, 6, 19, 12, 0, 0);

const job = (over: Partial<Job>): Job => ({
  id: "job-001",
  company: "Qualcomm",
  role: "Senior Platform Engineer",
  priorityTier: "2 - High",
  status: "Applied",
  dateApplied: "2026-07-05",
  compNotes: null,
  nextAction: null,
  followUpDate: null,
  contact: null,
  notes: null,
  postingUrl: null,
  resumeVersion: null,
  compBase: null,
  compBonus: null,
  compEquity: null,
  resumeId: null,
  coverLetterId: null,
  source: "manual" as const,
  skillMatch: null,
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
  ...over,
});

describe("followUpEmail", () => {
  it("Applied: application status inquiry with days and role", () => {
    const email = followUpEmail(job({}), "Maria", TODAY);
    expect(email.subject).toContain("Senior Platform Engineer");
    expect(email.body).toContain("Hi Maria,");
    expect(email.body).toContain("Qualcomm");
    expect(email.body).toMatch(/two weeks|14 days|applied/i);
  });

  it("interview stages: thank-you note naming the round", () => {
    const email = followUpEmail(job({ status: "HM Interview" }), null, TODAY);
    expect(email.body).toContain("Hi there,");
    expect(email.body).toMatch(/thank/i);
    expect(email.body).toMatch(/conversation|interview/i);
  });

  it("Offer: enthusiastic with timeline ask", () => {
    const email = followUpEmail(job({ status: "Offer" }), "Dana", TODAY);
    expect(email.body).toMatch(/offer/i);
    expect(email.body).toMatch(/timeline|details/i);
  });

  it("Evaluating: interest inquiry", () => {
    const email = followUpEmail(job({ status: "Evaluating", dateApplied: null }), null, TODAY);
    expect(email.body).toMatch(/interested|interest/i);
    expect(email.subject).toContain("Senior Platform Engineer");
  });

  it("always signs off and never contains template placeholders", () => {
    for (const status of ["Applied", "Screen", "Panel", "Offer"] as const) {
      const email = followUpEmail(job({ status }), null, TODAY);
      expect(email.body).not.toMatch(/\{|\}|undefined|null/);
      expect(email.body).toMatch(/Best regards,/);
    }
  });
});
