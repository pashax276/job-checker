import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  companyNameFromSlug,
  EMPTY_JOB_FORM,
  jobToFormValues,
  validateJobForm,
} from "@/lib/job-form";
import type { Job } from "@/lib/types";

const job: Job = {
  id: "job-001",
  company: "Acme",
  role: "Senior SRE",
  priorityTier: "2 - High",
  status: "Screen",
  dateApplied: "2026-07-01",
  compNotes: "$170k",
  nextAction: null,
  followUpDate: null,
  contact: null,
  notes: "n",
  postingUrl: "https://boards.greenhouse.io/acme/jobs/1",
  resumeVersion: "v3",
  compBase: null,
  compBonus: null,
  compEquity: null,
  resumeId: null,
  coverLetterId: null,
  source: "manual" as const,
  skillMatch: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("jobToFormValues", () => {
  it("maps nulls to empty strings and keeps values", () => {
    const values = jobToFormValues(job);
    expect(values.company).toBe("Acme");
    expect(values.nextAction).toBe("");
    expect(values.followUpDate).toBe("");
    expect(values.resumeVersion).toBe("v3");
  });
});

describe("validateJobForm", () => {
  it("returns parsed data for a valid form", () => {
    const result = validateJobForm({ ...EMPTY_JOB_FORM, company: "A", role: "B" });
    expect(result.data).not.toBeNull();
    expect(result.errors).toEqual({});
    expect(result.data?.priorityTier).toBe("3 - Mid");
  });

  it("keys errors by field name", () => {
    const result = validateJobForm({
      ...EMPTY_JOB_FORM,
      company: "",
      role: "R",
      postingUrl: "not a url",
      dateApplied: "07/01/2026",
    });
    expect(result.data).toBeNull();
    expect(result.errors.company).toMatch(/required/i);
    expect(result.errors.postingUrl).toBeTruthy();
    expect(result.errors.dateApplied).toMatch(/YYYY-MM-DD/);
    expect(result.errors.role).toBeUndefined();
  });
});

describe("addDaysIso", () => {
  it("adds days in local time", () => {
    expect(addDaysIso(new Date(2026, 6, 18, 12), 3)).toBe("2026-07-21");
    expect(addDaysIso(new Date(2026, 6, 30, 12), 7)).toBe("2026-08-06");
  });
});

describe("companyNameFromSlug", () => {
  it("title-cases slugs on separators", () => {
    expect(companyNameFromSlug("platformscience")).toBe("Platformscience");
    expect(companyNameFromSlug("ava-labs")).toBe("Ava Labs");
    expect(companyNameFromSlug("prize_picks")).toBe("Prize Picks");
    expect(companyNameFromSlug(null)).toBeNull();
  });
});
