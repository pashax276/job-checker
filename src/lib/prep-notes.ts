export interface PrepNotesSplit {
  main: string;
  sidebar: string | null;
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
