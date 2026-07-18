import { describe, expect, it } from "vitest";
import {
  classifyLocation,
  descriptionMatches,
  matchedKeywords,
  titleMatches,
} from "@/server/discovery/filters";

describe("titleMatches", () => {
  it.each([
    ["Senior Platform Engineer", true],
    ["Staff SRE", true],
    ["Sr. DevOps Engineer", true],
    ["Sr Site Reliability Engineer", true],
    ["Senior Infrastructure Engineer", true],
    ["Senior Software Engineer", false], // no domain keyword
    ["Platform Engineer", false], // no seniority keyword
    ["Junior Platform Engineer", false],
    ["Platform Engineering Intern", false],
    ["Senior DevOps Engineer (Entry Level)", false],
    ["Entry-Level Senior-track SRE", false],
  ])("%s -> %s", (title, expected) => {
    expect(titleMatches(title)).toBe(expected);
  });
});

describe("descriptionMatches", () => {
  it("requires an AWS mention", () => {
    expect(descriptionMatches("We run EKS on AWS at scale")).toBe(true);
    expect(descriptionMatches("Deep aws experience required")).toBe(true);
    expect(descriptionMatches("Azure and GCP only")).toBe(false);
    expect(descriptionMatches(null)).toBe(false);
  });
});

describe("classifyLocation", () => {
  it.each([
    ["San Diego, CA", "San Diego"],
    ["Hybrid — San Diego HQ", "San Diego"],
    ["Remote - United States", "Remote-US"],
    ["Remote (US)", "Remote-US"],
    ["US Remote", "Remote-US"],
    ["Remote - USA", "Remote-US"],
    ["Remote", "Unverified"], // country not stated — never guess
    ["Remote - Canada", "Unverified"],
    ["New York, NY", "Unverified"],
    [null, "Unverified"],
    ["", "Unverified"],
  ])("%s -> %s", (location, expected) => {
    expect(classifyLocation(location)).toBe(expected);
  });
});

describe("matchedKeywords", () => {
  it("reports which title keywords hit", () => {
    const hits = matchedKeywords("Senior Platform & SRE Engineer");
    expect(hits).toContain("Senior");
    expect(hits).toContain("Platform");
    expect(hits).toContain("SRE");
    expect(hits).not.toContain("DevOps");
  });
});
