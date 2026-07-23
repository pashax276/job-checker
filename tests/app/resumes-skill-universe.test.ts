import { describe, expect, it } from "vitest";
import {
  computeSkillUniverse,
  resumeCoverage,
} from "@/app/resumes/skill-universe";
import type { Job } from "@/lib/types";

const job = (over: Partial<Job>): Job => ({
  id: "job-001",
  company: "Acme",
  role: "Senior SRE",
  priorityTier: "3 - Mid",
  status: "Evaluating",
  dateApplied: null,
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
  jdSnapshot: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

const skillMatchJson = (matched: string[], missing: string[]) =>
  JSON.stringify({ score: 0, matched, missing, checkedAt: "2026-07-01" });

describe("computeSkillUniverse", () => {
  it("unions matched and missing skills across all checked jobs", () => {
    const jobs = [
      job({ id: "a", skillMatch: skillMatchJson(["AWS", "Kubernetes"], ["Go"]) }),
      job({ id: "b", skillMatch: skillMatchJson(["Terraform"], ["AWS", "GCP"]) }),
    ];
    expect(computeSkillUniverse(jobs)).toEqual(
      ["AWS", "GCP", "Go", "Kubernetes", "Terraform"].sort((a, b) =>
        a.localeCompare(b),
      ),
    );
  });

  it("ignores jobs that have never been checked", () => {
    const jobs = [job({ id: "a", skillMatch: null })];
    expect(computeSkillUniverse(jobs)).toEqual([]);
  });

  it("dedupes a skill appearing across multiple jobs", () => {
    const jobs = [
      job({ id: "a", skillMatch: skillMatchJson(["AWS"], []) }),
      job({ id: "b", skillMatch: skillMatchJson(["AWS"], []) }),
    ];
    expect(computeSkillUniverse(jobs)).toEqual(["AWS"]);
  });
});

describe("resumeCoverage", () => {
  it("counts case-insensitive overlap with the universe", () => {
    const universe = ["AWS", "GCP", "Go", "Kubernetes", "Terraform"];
    expect(resumeCoverage(["aws", "Kubernetes", "Terraform"], universe)).toEqual({
      covered: 3,
      total: 5,
    });
  });

  it("does not count resume skills outside the universe", () => {
    const universe = ["AWS"];
    expect(resumeCoverage(["AWS", "Photoshop"], universe)).toEqual({
      covered: 1,
      total: 1,
    });
  });

  it("returns 0/0 for an empty universe", () => {
    expect(resumeCoverage(["AWS"], [])).toEqual({ covered: 0, total: 0 });
  });
});
