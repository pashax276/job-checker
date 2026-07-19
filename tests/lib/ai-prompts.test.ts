import { describe, expect, it } from "vitest";
import {
  buildCoverLetterPrompt,
  buildFitPrompt,
  buildFollowUpPrompt,
  buildPrepPrompt,
} from "@/lib/ai-prompts";

describe("buildPrepPrompt", () => {
  it("carries role, company, stage, JD, and resume context", () => {
    const prompt = buildPrepPrompt({
      company: "Qualcomm",
      role: "Senior Platform Engineer",
      stage: "HM Interview",
      jdText: "We need Kubernetes and AWS at scale",
      resumeBullets: ["Built EKS platform"],
      missingSkills: ["Prometheus"],
    });
    expect(prompt).toContain("Qualcomm");
    expect(prompt).toContain("HM Interview");
    expect(prompt).toContain("Kubernetes and AWS");
    expect(prompt).toContain("Built EKS platform");
    expect(prompt).toContain("Prometheus");
    expect(prompt).toMatch(/questions/i);
  });

  it("caps very long JDs", () => {
    const prompt = buildPrepPrompt({
      company: "X",
      role: "R",
      stage: "Screen",
      jdText: "x".repeat(30_000),
      resumeBullets: [],
      missingSkills: [],
    });
    expect(prompt.length).toBeLessThan(15_000);
  });
});

describe("buildFollowUpPrompt", () => {
  it("includes stage, contact, and timing context", () => {
    const prompt = buildFollowUpPrompt({
      company: "FICO",
      role: "Senior DevOps Engineer",
      status: "Applied",
      contactName: "Dana",
      daysSinceApplied: 9,
      nextAction: "await response",
    });
    expect(prompt).toContain("FICO");
    expect(prompt).toContain("Dana");
    expect(prompt).toContain("9");
    expect(prompt).toMatch(/subject/i);
  });
});

describe("buildFitPrompt", () => {
  it("includes posting, blurb, and skills", () => {
    const prompt = buildFitPrompt({
      title: "Staff SRE",
      company: "NewCo",
      postingText: "Terraform everywhere",
      profileBlurb: "Senior platform engineer, SD-based",
      resumeSkills: ["AWS", "Terraform"],
    });
    expect(prompt).toContain("Staff SRE");
    expect(prompt).toContain("Terraform everywhere");
    expect(prompt).toContain("SD-based");
    expect(prompt).toMatch(/strong|moderate|weak/i);
  });
});

describe("buildCoverLetterPrompt", () => {
  it("includes JD, experience, and bullets", () => {
    const prompt = buildCoverLetterPrompt({
      company: "Acme",
      role: "Platform Engineer",
      jdText: "GitOps focus",
      resumeBullets: ["Led Argo CD adoption"],
      experience: [
        { company: "Kyriba", title: "DevOps Engineer", period: "2018-2024" },
      ],
    });
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("GitOps focus");
    expect(prompt).toContain("Led Argo CD adoption");
    expect(prompt).toContain("Kyriba");
  });
});
