import { describe, expect, it } from "vitest";
import { computeSkillMatch, stripHtmlToText } from "@/lib/skill-match";

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
