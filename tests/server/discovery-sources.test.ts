import { describe, expect, it } from "vitest";
import {
  buildBoardUrl,
  normalizeAshby,
  normalizeGreenhouse,
  normalizeLever,
  normalizeRecruitee,
  normalizeWorkable,
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

describe("workable + recruitee boards", () => {
  it("builds their public endpoints (workable needs details=true for descriptions)", () => {
    expect(buildBoardUrl("workable", "acme")).toBe(
      "https://apply.workable.com/api/v1/widget/accounts/acme?details=true",
    );
    expect(buildBoardUrl("recruitee", "acme")).toBe(
      "https://acme.recruitee.com/api/offers/",
    );
  });

  it("normalizes a workable payload, composing its split location fields", () => {
    // shape mirrors the live apply.workable.com widget response
    const [candidate] = normalizeWorkable(
      {
        jobs: [
          {
            title: "Senior Platform Engineer",
            url: "https://apply.workable.com/j/186545F8C1",
            city: "San Diego",
            state: "CA",
            country: "United States",
            telecommuting: true,
            description: "<p>We run on &lt;b&gt;AWS&lt;/b&gt;</p>",
          },
        ],
      },
      "Acme",
    );
    expect(candidate).toMatchObject({
      url: "https://apply.workable.com/j/186545F8C1",
      title: "Senior Platform Engineer",
      company: "Acme",
      atsType: "workable",
    });
    // telecommuting must surface as the word "Remote", or classifyLocation
    // can never resolve a remote-US role
    expect(candidate.location).toBe("Remote, San Diego, CA, United States");
    expect(candidate.description).toContain("<b>AWS</b>");
  });

  it("skips workable entries missing a title or a usable url", () => {
    expect(
      normalizeWorkable(
        { jobs: [{ title: "No URL" }, { url: "https://x/y" }] },
        "Acme",
      ),
    ).toEqual([]);
  });

  it("normalizes a recruitee payload, folding requirements into the description", () => {
    // AWS frequently appears only in Recruitee's separate requirements field,
    // which the description gate would otherwise never see
    const [candidate] = normalizeRecruitee(
      {
        offers: [
          {
            title: "Staff SRE",
            careers_url: "https://acme.recruitee.com/o/staff-sre",
            location: "United States",
            remote: true,
            description: "<p>Join us</p>",
            requirements: "<p>5 years AWS</p>",
          },
        ],
      },
      "Acme",
    );
    expect(candidate).toMatchObject({
      url: "https://acme.recruitee.com/o/staff-sre",
      title: "Staff SRE",
      atsType: "recruitee",
    });
    expect(candidate.description).toContain("AWS");
    expect(candidate.location).toBe("Remote, United States");
  });

  it("detects both from a pasted posting URL", () => {
    expect(detectAtsType("https://apply.workable.com/j/186545F8C1")).toBe(
      "workable",
    );
    expect(detectAtsType("https://acme.recruitee.com/o/staff-sre")).toBe(
      "recruitee",
    );
  });

  it("recovers a company slug only where the URL actually carries one", () => {
    expect(companySlugFromUrl("https://acme.recruitee.com/o/staff-sre")).toBe(
      "acme",
    );
    expect(companySlugFromUrl("https://apply.workable.com/acme/j/ABC123")).toBe(
      "acme",
    );
    // the short /j/{shortcode} form has no account in it — must not invent one
    expect(
      companySlugFromUrl("https://apply.workable.com/j/186545F8C1"),
    ).toBeNull();
  });
});
