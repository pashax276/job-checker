import { describe, expect, it } from "vitest";
import {
  buildBoardUrl,
  normalizeAshby,
  normalizeGreenhouse,
  normalizeLever,
} from "@/server/discovery/ats";
import {
  companySlugFromUrl,
  detectAtsType,
  extractTargetUrl,
  rssItemToCandidate,
} from "@/server/discovery/rss";

describe("buildBoardUrl", () => {
  it("builds the documented public endpoints", () => {
    expect(buildBoardUrl("greenhouse", "acme")).toBe(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
    );
    expect(buildBoardUrl("lever", "acme")).toBe(
      "https://api.lever.co/v0/postings/acme?mode=json",
    );
    expect(buildBoardUrl("ashby", "acme")).toBe(
      "https://api.ashbyhq.com/posting-api/job-board/acme",
    );
  });
});

describe("normalizers", () => {
  it("normalizes greenhouse payloads", () => {
    const candidates = normalizeGreenhouse(
      {
        jobs: [
          {
            absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
            title: "Senior Platform Engineer",
            location: { name: "San Diego, CA" },
            content: "We use &lt;b&gt;AWS&lt;/b&gt; heavily",
          },
        ],
      },
      "Acme",
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: "https://boards.greenhouse.io/acme/jobs/1",
      title: "Senior Platform Engineer",
      location: "San Diego, CA",
      company: "Acme",
      atsType: "greenhouse",
    });
    expect(candidates[0].description).toContain("AWS");
  });

  it("normalizes lever payloads", () => {
    const candidates = normalizeLever(
      [
        {
          hostedUrl: "https://jobs.lever.co/acme/uuid-1",
          text: "Staff SRE",
          categories: { location: "Remote - United States" },
          descriptionPlain: "AWS + Kubernetes",
        },
      ],
      "Acme",
    );
    expect(candidates[0]).toMatchObject({
      url: "https://jobs.lever.co/acme/uuid-1",
      title: "Staff SRE",
      location: "Remote - United States",
      atsType: "lever",
    });
  });

  it("normalizes ashby payloads", () => {
    const candidates = normalizeAshby(
      {
        jobs: [
          {
            title: "Senior Infrastructure Engineer",
            location: "Remote (US)",
            jobUrl: "https://jobs.ashbyhq.com/acme/uuid-2",
            descriptionHtml: "<p>AWS-based platform</p>",
          },
        ],
      },
      "Acme",
    );
    expect(candidates[0]).toMatchObject({
      url: "https://jobs.ashbyhq.com/acme/uuid-2",
      atsType: "ashby",
      location: "Remote (US)",
    });
  });
});

describe("google alerts rss helpers", () => {
  it("extracts the target url from a google redirect", () => {
    expect(
      extractTargetUrl(
        "https://www.google.com/url?rct=j&url=https://boards.greenhouse.io/acme/jobs/9&ct=ga",
      ),
    ).toBe("https://boards.greenhouse.io/acme/jobs/9");
  });

  it("passes through direct urls", () => {
    expect(extractTargetUrl("https://jobs.lever.co/x/1")).toBe(
      "https://jobs.lever.co/x/1",
    );
  });

  it("detects ats type from url patterns", () => {
    expect(detectAtsType("https://boards.greenhouse.io/acme/jobs/1")).toBe("greenhouse");
    expect(detectAtsType("https://jobs.lever.co/acme/1")).toBe("lever");
    expect(detectAtsType("https://jobs.ashbyhq.com/acme/1")).toBe("ashby");
    expect(detectAtsType("https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x")).toBe("workday");
    expect(detectAtsType("https://example.com/careers")).toBeNull();
  });

  it("parses the company slug where the pattern allows", () => {
    expect(companySlugFromUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe("acme");
    expect(companySlugFromUrl("https://jobs.lever.co/babylist/uuid")).toBe("babylist");
    expect(companySlugFromUrl("https://jobs.ashbyhq.com/talkiatry/uuid")).toBe("talkiatry");
    expect(companySlugFromUrl("https://acme.wd5.myworkdayjobs.com/careers")).toBe("acme");
    expect(companySlugFromUrl("https://example.com/x")).toBeNull();
  });

  it("converts an alerts item into a lead candidate with cleaned title", () => {
    const candidate = rssItemToCandidate({
      title: "<b>Senior DevOps Engineer</b> - Acme &amp; Co",
      link: "https://www.google.com/url?url=https://jobs.lever.co/acme/uuid&x=1",
    });
    expect(candidate).toMatchObject({
      url: "https://jobs.lever.co/acme/uuid",
      title: "Senior DevOps Engineer - Acme & Co",
      atsType: "lever",
      company: "acme",
    });
  });
});
