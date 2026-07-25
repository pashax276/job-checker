export interface PrepNotesSplit {
  main: string;
  sidebar: string | null;
}

export interface PrepQuestion {
  id: string;
  text: string;
  response: string | null;
  askedBy: "me" | "interviewer";
}

const QUESTIONS_TO_ASK_HEADING = /^#{1,6}\s*.*questions?\s+to\s+ask.*$/im;

/**
 * Splits free-text prep notes at a "Questions to ask" markdown heading, if
 * present, so the UI can render it as a distinct sidebar instead of burying
 * it in the middle of a long narrative brief. Notes without that heading
 * (plain manual jottings, AI output from the built-in plain-text generator)
 * render as a single column unchanged.
 */
export function splitPrepNotes(text: string): PrepNotesSplit {
  const match = text.match(QUESTIONS_TO_ASK_HEADING);
  if (!match || match.index === undefined) {
    return { main: text, sidebar: null };
  }
  return {
    main: text.slice(0, match.index).trim(),
    sidebar: text.slice(match.index).trim(),
  };
}

/**
 * Pulls numbered-list question text out of a "Questions to ask" markdown
 * section (the sidebar half of splitPrepNotes), stopping at the next
 * heading — AI-generated briefs often follow with a "## Reminders"
 * section that isn't part of the question list. Used to one-time-seed
 * structured question records from free-text notes.
 */
export function extractQuestionsFromMarkdown(sidebar: string): string[] {
  const withoutHeading = sidebar.replace(QUESTIONS_TO_ASK_HEADING, "").trim();
  const nextHeading = withoutHeading.match(/^#{1,6}\s+/m);
  const section =
    nextHeading?.index !== undefined
      ? withoutHeading.slice(0, nextHeading.index)
      : withoutHeading;
  const items: string[] = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}
