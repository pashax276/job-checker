import { describe, expect, it } from "vitest";
import {
  classifyLocation,
  descriptionMatches,
  locationAllowed,
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

    // The discipline names the role — always in scope.
    ["Staff Infrastructure Security Engineer", true],
    ["Sr. Staff Production Engineer - Data Platform", true],
    ["Sr. IT Site Reliability Software Engineer", true],
    [
      "Site Reliability Engineer, Intermediate to Senior Staff — Infrastructure Platforms",
      true,
    ],

    // "Software Engineer" on a genuinely core-infra team still counts.
    ["Senior Staff+ Software Engineer, Kubernetes Platform", true],
    ["Staff Software Engineer, Compute Infrastructure", true],
    ["Staff Software Engineer (L4) Data Platform", true],
    ["Staff Engineer, Core Infrastructure", true],
    ["Staff Software Engineer, Storage Platform", true],

    // ...but an ML/AI or product-flavoured "platform" is a different job.
    ["Senior Software Engineer, GenAI Platform", false],
    ["Staff Software Engineer, Machine Learning Platform", false],
    ["Senior Software Engineer, Backend (ML Feature Platform)", false],
    ["Senior Software engineer (Furnishing Platform)", false],
    [
      "Senior Software Engineer - Full Stack Internal Tooling (Build and Deployment Platform)",
      false,
    ],
    ["Staff+ Software Engineer, Safeguards ML Infrastructure", false],

    // Not individual-contributor engineering, however infra-flavoured the
    // team is. "Sr. Product Manager, Compute Platform" used to pass on the
    // word "Compute" and was only ever cut by its location.
    ["Senior Engineering Manager for Workspace Platform", false],
    ["Sr. Manager, Engineering Configuration Platform Team", false],
    ["Sr. Product Manager, Compute Platform", false],
    ["Staff Technical Program Manager- Platform Features", false],
    ["Senior Technical Solutions Engineer (Platform)", false],
    ["Senior Customer Engineer- Cloudflare Developer Platform", false],
    ["Senior Director of Product, Ads Platform", false],
    ["Senior Support Engineer, Cloud Infrastructure", false],
    // ...but a plain IC title is untouched
    ["Senior Site Reliability Engineer", true],
    ["Staff Infrastructure Engineer", true],

    // The discipline can trail the role: Babylist posts its SRE opening as
    // "Staff Engineer, Site Reliability", which the "discipline before
    // Engineer" rule read as a team name and turned away.
    ["Staff Engineer, Site Reliability", true],
    ["Senior Engineer - Site Reliability", true],
    ["Senior Software Engineer (Site Reliability)", true],
    // seniority and the non-IC cut still apply to it
    ["Engineer, Site Reliability", false],
    ["Senior Manager, Site Reliability", false],
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
    [null, "Unverified"],
    ["", "Unverified"],
    // remote, but explicitly somewhere we can't work
    ["Remote - Canada", "Remote-other"],
    ["Remote Poland", "Remote-other"],
    ["Remote, United Kingdom", "Remote-other"],
    // a named place that is neither San Diego nor remote — knowably wrong,
    // and previously lumped into "Unverified" alongside genuine unknowns
    ["New York, NY", "Onsite-elsewhere"],
    ["San Francisco, California", "Onsite-elsewhere"],
    ["San Francisco, CA | New York City, NY | Seattle, WA", "Onsite-elsewhere"],
    ["Mountain View, California; San Francisco, California", "Onsite-elsewhere"],
    ["Bengaluru, India", "Onsite-elsewhere"],
    ["Amsterdam, Netherlands", "Onsite-elsewhere"],
    ["London, England, United Kingdom", "Onsite-elsewhere"],
    // a multi-site listing that includes US remote still qualifies
    ["Remote, Canada; Remote, United Kingdom; Remote, US", "Remote-US"],
    // San Diego wins even when listed alongside other sites
    ["San Diego, CA; Austin, TX", "San Diego"],
    // a bare US state is still an office that isn't San Diego
    ["Virginia", "Onsite-elsewhere"],
    ["Washington", "Onsite-elsewhere"],
    // ...but "Remote - US" must not be dragged in by a state name
    ["Remote - US", "Remote-US"],
    ["Remote, Washington", "Remote-US"],

    // "City, ST" is how most US postings name a place, and a state code is
    // as much US evidence as a spelled-out state. PrizePicks' remote SRE role
    // ("Atlanta, GA preferred, Remote") was being filed as remote-abroad.
    ["Atlanta, GA preferred, Remote", "Remote-US"],
    ["Remote - Denver, CO", "Remote-US"],
    ["Austin, TX (Remote)", "Remote-US"],
    ["Remote; Boston, MA or New York, NY", "Remote-US"],
    // without "remote" it is still an office that isn't San Diego
    ["Atlanta, GA", "Onsite-elsewhere"],
    // a code that isn't a US state is no evidence
    ["Remote - Toronto, ON", "Remote-other"],
    ["Remote - London, UK", "Remote-other"],
    // a few codes double as countries (IL, IN, DE); a named country settles it
    ["Remote - Tel Aviv, IL, Israel", "Remote-other"],
    ["Remote - Bengaluru, IN, India", "Remote-other"],
    // lower-case words that merely look like codes don't count
    ["Remote, in Europe", "Remote-other"],
  ])("%s -> %s", (location, expected) => {
    expect(classifyLocation(location)).toBe(expected);
  });
});

describe("locationAllowed — must be San Diego or US-remote", () => {
  it("accepts San Diego and US remote", () => {
    expect(locationAllowed("San Diego")).toBe(true);
    expect(locationAllowed("Remote-US")).toBe(true);
  });

  it("rejects onsite-elsewhere and remote outside the US", () => {
    expect(locationAllowed("Onsite-elsewhere")).toBe(false);
    expect(locationAllowed("Remote-other")).toBe(false);
  });

  it("keeps genuinely unreadable locations for manual triage rather than dropping them", () => {
    expect(locationAllowed("Unverified")).toBe(true);
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
