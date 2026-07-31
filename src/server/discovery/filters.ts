export type LocationClass =
  | "San Diego"
  | "Remote-US"
  | "Remote-other"
  | "Onsite-elsewhere"
  | "Unverified";

const SENIORITY_RE = /\b(Senior|Staff|Sr\.?)\b/i;
const EXCLUDE_RE = /(Junior|Intern\b|Entry.Level)/i;
const AWS_RE = /\bAWS\b/i;

// The discipline names the role itself: "Infrastructure Engineer", "Site
// Reliability Engineer", "Production Engineer". The domain word has to sit
// *before* "Engineer" to count here.
const ROLE_NOUN_RE =
  /\b(Platform|DevOps|SRE|Site Reliability|Infrastructure|Production|Cloud|Systems)\b[\w+.,\-() ]{0,22}\bEngineer\b/i;

// "Staff SRE" needs no "Engineer" — the acronym already is the job title.
const STANDALONE_ROLE_RE = /\b(SRE|DevOps)\b/i;

// Otherwise the title is some flavour of "Software Engineer" and the domain
// word is really a team name. That still counts when the team is core infra…
const CORE_INFRA_TEAM_RE =
  /\b(Infrastructure|Kubernetes|Cloud|Compute|Storage|Data Platform|Platform and Infrastructure|Core Infrastructure)\b/i;

// …but not when it's an ML/AI or product-shaped "platform", which is a
// different job that happens to share the word.
const NON_INFRA_QUALIFIER_RE =
  /\b(GenAI|Gen AI|Machine Learning|ML|AI|Full.?Stack|Frontend|Front.?End|Mobile|Backend|Furnishing|GRC|Safeguards|Growth|Payments|Ads)\b/i;

/**
 * Title gate: seniority, no exclusion keyword, and the role has to actually
 * be platform/infra work — either the discipline names the role, or it's a
 * software-engineering role on a core-infrastructure team. A title like
 * "Senior Software Engineer, GenAI Platform" mentions "Platform" but is not
 * the same job, so a bare keyword match anywhere in the title isn't enough.
 */
export function titleMatches(title: string): boolean {
  if (!SENIORITY_RE.test(title) || EXCLUDE_RE.test(title)) return false;
  if (ROLE_NOUN_RE.test(title) || STANDALONE_ROLE_RE.test(title)) return true;
  return CORE_INFRA_TEAM_RE.test(title) && !NON_INFRA_QUALIFIER_RE.test(title);
}

/** Description gate: must mention AWS. Missing description never passes. */
export function descriptionMatches(description: string | null): boolean {
  return description !== null && AWS_RE.test(description);
}

// A place name implies an office. Matching "City, ST" / "City, Country" is
// enough to tell "somewhere that isn't San Diego" from "we genuinely can't
// tell", which the old two-plus-Unverified split couldn't express.
const NAMED_PLACE_RE = /[A-Za-z][A-Za-z.'’\- ]+,\s*[A-Za-z][A-Za-z.'’\- ]+/;

// Named explicitly rather than inferred: "Remote - Canada" carries no comma
// pattern to key off, so the only honest way to place it is to recognise the
// country. Anything not on this list stays Unverified rather than guessed.
const NON_US_PLACE_RE = new RegExp(
  `\\b(${[
    "Canada", "United Kingdom", "UK", "Ireland", "Poland", "India", "Netherlands",
    "Germany", "France", "Spain", "Portugal", "Italy", "Greece", "Switzerland",
    "Austria", "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Czechia",
    "Czech Republic", "Romania", "Bulgaria", "Ukraine", "Serbia", "Croatia",
    "Hungary", "Israel", "Turkey", "Egypt", "Nigeria", "Kenya", "South Africa",
    "Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru", "Costa Rica",
    "Uruguay", "Australia", "New Zealand", "Japan", "Singapore", "China",
    "Hong Kong", "Taiwan", "Korea", "Philippines", "Vietnam", "Thailand",
    "Indonesia", "Malaysia", "Pakistan", "Bangladesh", "EMEA", "APAC", "LATAM",
    "Europe",
  ].join("|")})\\b`,
  "i",
);

// A US state named on its own ("Virginia") is still an office somewhere that
// isn't San Diego — placeable, so it shouldn't fall through to Unverified.
const US_STATE_RE = new RegExp(
  `\\b(${[
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming",
  ].join("|")})\\b`,
  "i",
);

/**
 * Location classification mirrors the owner's manual discipline — never guess.
 * San Diego and US-remote are the two acceptable outcomes; a location that
 * names somewhere else, or offers remote outside the US, is classified as
 * such so it can be filtered out rather than sitting in the same bucket as a
 * genuinely unreadable one.
 */
export function classifyLocation(location: string | null): LocationClass {
  if (!location) return "Unverified";
  // San Diego wins outright, even in a multi-site listing.
  if (/san diego/i.test(location)) return "San Diego";

  const remote = /\bremote\b|\bdistributed\b|\btelecommut/i.test(location);
  const us =
    /\b(united states|usa|u\.s\.a\.|u\.s\.|america)\b/i.test(location) ||
    /\bus\b/i.test(location.replace(/[()\-–—,;|/]/g, " ")) ||
    // "Remote, Washington" is remote *within* the US — a state name is
    // US evidence, and only consulted when the role is already remote.
    US_STATE_RE.test(location);
  if (remote && us) return "Remote-US";
  const placed =
    NAMED_PLACE_RE.test(location) ||
    NON_US_PLACE_RE.test(location) ||
    US_STATE_RE.test(location);
  // Remote, but the only places named are ones we can't work from.
  if (remote && placed) return "Remote-other";
  if (remote) return "Unverified"; // "Remote" alone — country not stated
  // Not remote, and it names a place: an office somewhere that isn't San Diego.
  if (placed) return "Onsite-elsewhere";
  return "Unverified";
}

/**
 * The owner's hard constraint: a role is only workable if it's in San Diego
 * or remote within the US. Unreadable locations are kept deliberately — a
 * lead we can't classify is worth eyeballing in the Inbox, whereas one we
 * can positively place elsewhere is not.
 */
export function locationAllowed(locationClass: LocationClass): boolean {
  return locationClass !== "Onsite-elsewhere" && locationClass !== "Remote-other";
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
