import { describe, expect, it } from "vitest";
import {
  computeSkillMatch,
  matchesSkillFilter,
  skillMatchBucket,
  stripHtmlToText,
} from "@/lib/skill-match";

const JD_HTML = `
<html><head><style>.x{color:red}</style><script>track()</script></head>
<body><h1>Senior Platform Engineer</h1>
<ul><li>Deep AWS and Kubernetes experience</li>
<li>Terraform, Prometheus, and Grafana</li>
<li>Golang or Python</li></ul></body></html>`;

describe("stripHtmlToText", () => {
  it("removes tags, scripts, and styles but keeps text", () => {
    const text = stripHtmlToText(JD_HTML);
    expect(text).toContain("AWS and Kubernetes");
    expect(text).not.toContain("<li>");
    expect(text).not.toContain("track()");
    expect(text).not.toContain("color:red");
  });
});

describe("computeSkillMatch", () => {
  it("scores the overlap between resume skills and JD skills", () => {
    const result = computeSkillMatch(
      ["AWS", "Kubernetes", "Terraform", "Docker"],
      stripHtmlToText(JD_HTML),
    );
    expect(result.matched).toEqual(
      expect.arrayContaining(["AWS", "Kubernetes", "Terraform"]),
    );
    expect(result.missing).toEqual(
      expect.arrayContaining(["Prometheus", "Grafana", "Python"]),
    );
    expect(result.missing).not.toContain("AWS");
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.score).toBeLessThan(1);
  });

  it("is a full match when the resume covers every JD skill", () => {
    const result = computeSkillMatch(["AWS", "Python"], "We need AWS and Python");
    expect(result.score).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it("returns zero when the JD mentions no known skills", () => {
    const result = computeSkillMatch(["AWS"], "We sell furniture");
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
  });

  it("matches case-insensitively against the resume list", () => {
    const result = computeSkillMatch(["aws"], "AWS required");
    expect(result.matched).toEqual(["AWS"]);
  });
});

describe("skillMatchBucket", () => {
  const at = (score: number): string =>
    JSON.stringify({ score, matched: [], missing: [], checkedAt: "2026-07-31" });

  it("buckets by the same thresholds the board tiles already colour by", () => {
    expect(skillMatchBucket(at(0.9))).toBe("strong");
    expect(skillMatchBucket(at(0.7))).toBe("strong"); // boundary is inclusive
    expect(skillMatchBucket(at(0.69))).toBe("partial");
    expect(skillMatchBucket(at(0.4))).toBe("partial"); // boundary is inclusive
    expect(skillMatchBucket(at(0.39))).toBe("weak");
    expect(skillMatchBucket(at(0))).toBe("weak");
  });

  it("reports a job that has never been checked as its own bucket", () => {
    expect(skillMatchBucket(null)).toBe("unchecked");
    expect(skillMatchBucket("not json")).toBe("unchecked");
  });
});

describe("matchesSkillFilter", () => {
  const at = (score: number): string =>
    JSON.stringify({ score, matched: [], missing: [], checkedAt: "2026-07-31" });

  it("passes everything when no filter is set", () => {
    expect(matchesSkillFilter(at(0.1), undefined)).toBe(true);
    expect(matchesSkillFilter(null, undefined)).toBe(true);
  });

  it("keeps only the selected bucket", () => {
    expect(matchesSkillFilter(at(0.8), "strong")).toBe(true);
    expect(matchesSkillFilter(at(0.5), "strong")).toBe(false);
    expect(matchesSkillFilter(null, "unchecked")).toBe(true);
    expect(matchesSkillFilter(at(0.8), "unchecked")).toBe(false);
  });

  it("'checked' accepts any real score but never an unchecked job", () => {
    expect(matchesSkillFilter(at(0.05), "checked")).toBe(true);
    expect(matchesSkillFilter(at(0.95), "checked")).toBe(true);
    expect(matchesSkillFilter(null, "checked")).toBe(false);
  });
});
