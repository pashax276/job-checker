export type LocationClass = "San Diego" | "Remote-US" | "Unverified";

const SENIORITY_RE = /\b(Senior|Staff|Sr\.?)\b/i;
const DOMAIN_RE = /\b(Platform|DevOps|SRE|Site Reliability|Infrastructure)\b/i;
const EXCLUDE_RE = /(Junior|Intern\b|Entry.Level)/i;
const AWS_RE = /\bAWS\b/i;

/** Title gate: seniority AND domain keyword, and no exclusion keyword. */
export function titleMatches(title: string): boolean {
  return (
    SENIORITY_RE.test(title) && DOMAIN_RE.test(title) && !EXCLUDE_RE.test(title)
  );
}

/** Description gate: must mention AWS. Missing description never passes. */
export function descriptionMatches(description: string | null): boolean {
  return description !== null && AWS_RE.test(description);
}

/**
 * Location classification mirrors the owner's manual discipline — never guess:
 * explicit San Diego, explicitly US remote, otherwise Unverified.
 */
export function classifyLocation(location: string | null): LocationClass {
  if (!location) return "Unverified";
  if (/san diego/i.test(location)) return "San Diego";
  const remote = /\bremote\b/i.test(location);
  const us =
    /\b(united states|usa|u\.s\.a\.|u\.s\.|america)\b/i.test(location) ||
    /\bus\b/i.test(location.replace(/[()\-–—,]/g, " "));
  if (remote && us) return "Remote-US";
  return "Unverified";
}

const KEYWORDS = [
  "Senior",
  "Staff",
  "Platform",
  "DevOps",
  "SRE",
  "Site Reliability",
  "Infrastructure",
] as const;

/** Which watched keywords appear in a title (stored on the lead for context). */
export function matchedKeywords(title: string): string[] {
  return KEYWORDS.filter((k) =>
    new RegExp(`\\b${k.replace(" ", "\\s+")}\\b`, "i").test(title),
  );
}
