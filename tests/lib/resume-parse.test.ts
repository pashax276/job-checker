import { describe, expect, it } from "vitest";
import {
  extractBullets,
  extractExperience,
  extractSkills,
} from "@/lib/resume-parse";

// Shape mirrors real PDF extraction: dash markers, wrapped continuation
// lines, ALL-CAPS section headers, pipe-separated employer lines.
const PDF_SHAPED = `JANE DOE
Senior Platform Engineer
PROFESSIONAL EXPERIENCE
Kyriba | Senior Platform / DevOps Engineer | Apr 2024 - Present
San Diego, CA
- Own platform engineering and DevOps automation across approximately 10 FinTech SaaS platforms with
sandbox, pre-production, and production environments, multiple EKS clusters, and 400+ Linux hosts.
- Lead the CentOS 7 to Amazon Linux 2023 modernization across application and EKS fleets.
Acme Corp | Cloud Engineer | Jan 2020 - Mar 2024
- Built Terraform modules used by 6 teams.
CORE SKILLS
Cloud: AWS, EC2, Kubernetes
`;

const SAMPLE = `PAVLO LISNYKOV
Senior Platform Engineer

EXPERIENCE:
• Built multi-region EKS platform on AWS serving 200+ services
- Cut deploy time 80% with GitHub Actions and Argo CD GitOps pipelines
– Led Terraform module library adopted by 6 teams
* On-call lead; reduced MTTR from 45m to 12m

SKILLS
Kubernetes, Terraform, Docker, Python, CI/CD, Prometheus

I worked at Google before.
`;

describe("extractBullets", () => {
  it("extracts marker-prefixed lines with markers stripped, in order", () => {
    const bullets = extractBullets(SAMPLE);
    expect(bullets[0]).toBe("Built multi-region EKS platform on AWS serving 200+ services");
    expect(bullets[1]).toMatch(/^Cut deploy time 80%/);
    expect(bullets[2]).toMatch(/^Led Terraform module library/);
    expect(bullets[3]).toMatch(/^On-call lead/);
    expect(bullets).toHaveLength(4);
  });

  it("ignores headers and blank lines", () => {
    const bullets = extractBullets(SAMPLE);
    expect(bullets.join("\n")).not.toMatch(/EXPERIENCE|SKILLS|PAVLO/);
  });

  it("returns empty for empty text", () => {
    expect(extractBullets("")).toEqual([]);
  });

  it("merges wrapped continuation lines into their bullet", () => {
    const bullets = extractBullets(PDF_SHAPED);
    expect(bullets[0]).toContain("400+ Linux hosts");
    expect(bullets[0]).toMatch(/platforms with sandbox, pre-production/);
    expect(bullets[1]).toMatch(/^Lead the CentOS 7/);
    expect(bullets).toHaveLength(3);
  });

  it("does not glue employer or header lines into bullets", () => {
    const bullets = extractBullets(PDF_SHAPED).join("\n");
    expect(bullets).not.toContain("Acme Corp |");
    expect(bullets).not.toContain("CORE SKILLS");
  });
});

describe("extractExperience", () => {
  it("parses pipe-separated employer lines into job history", () => {
    const experience = extractExperience(PDF_SHAPED);
    expect(experience).toEqual([
      {
        company: "Kyriba",
        title: "Senior Platform / DevOps Engineer",
        period: "Apr 2024 - Present",
      },
      {
        company: "Acme Corp",
        title: "Cloud Engineer",
        period: "Jan 2020 - Mar 2024",
      },
    ]);
  });

  it("ignores pipe lines without a date-like third part", () => {
    expect(
      extractExperience("San Diego, CA | 858-000-0000 | someone@example.com"),
    ).toEqual([]);
  });
});

describe("extractSkills", () => {
  it("finds dictionary skills case-insensitively with canonical casing", () => {
    const skills = extractSkills(SAMPLE);
    expect(skills).toContain("AWS");
    expect(skills).toContain("Kubernetes");
    expect(skills).toContain("EKS");
    expect(skills).toContain("Terraform");
    expect(skills).toContain("GitHub Actions");
    expect(skills).toContain("Argo CD");
    expect(skills).toContain("CI/CD");
    expect(skills).toContain("Python");
  });

  it("respects word boundaries (Google must not match Go)", () => {
    expect(extractSkills("I worked at Google")).not.toContain("Go");
    expect(extractSkills("Wrote services in Go")).toContain("Go");
  });

  it("dedupes repeated mentions", () => {
    const skills = extractSkills("AWS aws AWS");
    expect(skills.filter((s) => s === "AWS")).toHaveLength(1);
  });
});
