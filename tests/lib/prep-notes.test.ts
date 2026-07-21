import { describe, expect, it } from "vitest";
import { splitPrepNotes } from "@/lib/prep-notes";

describe("splitPrepNotes", () => {
  it("returns the whole text as main with no sidebar when there is no heading", () => {
    const text = "Ask about the team structure.\nMention the Argo CD rollout.";
    expect(splitPrepNotes(text)).toEqual({ main: text, sidebar: null });
  });

  it("splits at a '## Questions to ask' heading, any level or wording", () => {
    const text = [
      "# TFN Brief",
      "",
      "## Company snapshot",
      "PE-backed, Dallas HQ.",
      "",
      "## Questions to ask him",
      "1. Is this remote?",
      "2. What's the comp range?",
    ].join("\n");
    const { main, sidebar } = splitPrepNotes(text);
    expect(main).toContain("Company snapshot");
    expect(main).not.toContain("Questions to ask");
    expect(sidebar).toContain("Questions to ask him");
    expect(sidebar).toContain("What's the comp range?");
  });

  it("matches case-insensitively and at any heading depth", () => {
    const text = "Intro text\n\n### QUESTIONS TO ASK\n- one\n- two";
    const { sidebar } = splitPrepNotes(text);
    expect(sidebar).toBe("### QUESTIONS TO ASK\n- one\n- two");
  });

  it("trims whitespace on both halves", () => {
    const text = "Intro.\n\n\n## Questions to ask\n\nWhy this role?\n";
    const { main, sidebar } = splitPrepNotes(text);
    expect(main).toBe("Intro.");
    expect(sidebar).toBe("## Questions to ask\n\nWhy this role?");
  });
});
