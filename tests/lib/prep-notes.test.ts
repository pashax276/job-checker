import { describe, expect, it } from "vitest";
import { extractQuestionsFromMarkdown, splitPrepNotes } from "@/lib/prep-notes";

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

describe("extractQuestionsFromMarkdown", () => {
  it("pulls numbered list items out of the questions section", () => {
    const sidebar = [
      "## Questions to ask him (aim for 6–8)",
      "1. Is this role remote, or based in Dallas?",
      "2. Who else is currently on infrastructure?",
      "3. What triggered this hire now?",
    ].join("\n");
    expect(extractQuestionsFromMarkdown(sidebar)).toEqual([
      "Is this role remote, or based in Dallas?",
      "Who else is currently on infrastructure?",
      "What triggered this hire now?",
    ]);
  });

  it("stops at the next heading — a trailing Reminders section isn't a question", () => {
    const sidebar = [
      "## Questions to ask",
      "1. Why this role?",
      "2. What's the timeline?",
      "",
      "## REMINDERS",
      "- Purpose is information-gathering.",
      "- Two anchor stories, hold comp until he moves first.",
    ].join("\n");
    expect(extractQuestionsFromMarkdown(sidebar)).toEqual([
      "Why this role?",
      "What's the timeline?",
    ]);
  });

  it("accepts '1)' style numbering too", () => {
    const sidebar = "## Questions to ask\n1) First one\n2) Second one";
    expect(extractQuestionsFromMarkdown(sidebar)).toEqual([
      "First one",
      "Second one",
    ]);
  });

  it("returns an empty array when there are no numbered items", () => {
    expect(extractQuestionsFromMarkdown("## Questions to ask\nJust prose.")).toEqual(
      [],
    );
  });
});
