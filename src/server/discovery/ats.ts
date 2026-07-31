export type AtsType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "recruitee";

export interface PostingCandidate {
  url: string;
  title: string;
  company: string | null;
  description: string | null;
  location: string | null;
  atsType: AtsType | "workday" | null;
}

export const DISCOVERY_USER_AGENT =
  "job-tracker/1.0 (self-hosted personal application tracker)";

export function buildBoardUrl(atsType: AtsType, slug: string): string {
  switch (atsType) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    case "lever":
      return `https://api.lever.co/v0/postings/${slug}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    case "workable":
      // `details=true` is what promotes the response from titles-only to
      // one that carries each posting's full description.
      return `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`;
    case "recruitee":
      return `https://${slug}.recruitee.com/api/offers/`;
  }
}

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

interface GreenhousePayload {
  jobs?: Array<{
    absolute_url?: string;
    title?: string;
    location?: { name?: string };
    content?: string;
  }>;
}

export function normalizeGreenhouse(
  payload: unknown,
  company: string,
): PostingCandidate[] {
  const jobs = (payload as GreenhousePayload).jobs ?? [];
  return jobs.flatMap((job) => {
    const url = asString(job.absolute_url);
    const title = asString(job.title);
    if (!url || !title) return [];
    return [
      {
        url,
        title,
        company,
        description: job.content ? decodeEntities(job.content) : null,
        location: asString(job.location?.name),
        atsType: "greenhouse" as const,
      },
    ];
  });
}

interface LeverPosting {
  hostedUrl?: string;
  text?: string;
  categories?: { location?: string };
  descriptionPlain?: string;
  description?: string;
}

export function normalizeLever(
  payload: unknown,
  company: string,
): PostingCandidate[] {
  const postings = Array.isArray(payload) ? (payload as LeverPosting[]) : [];
  return postings.flatMap((p) => {
    const url = asString(p.hostedUrl);
    const title = asString(p.text);
    if (!url || !title) return [];
    return [
      {
        url,
        title,
        company,
        description: asString(p.descriptionPlain) ?? asString(p.description),
        location: asString(p.categories?.location),
        atsType: "lever" as const,
      },
    ];
  });
}

interface AshbyPayload {
  jobs?: Array<{
    jobUrl?: string;
    applyUrl?: string;
    title?: string;
    location?: string;
    descriptionHtml?: string;
    descriptionPlain?: string;
  }>;
}

export function normalizeAshby(
  payload: unknown,
  company: string,
): PostingCandidate[] {
  const jobs = (payload as AshbyPayload).jobs ?? [];
  return jobs.flatMap((job) => {
    const url = asString(job.jobUrl) ?? asString(job.applyUrl);
    const title = asString(job.title);
    if (!url || !title) return [];
    return [
      {
        url,
        title,
        company,
        description:
          asString(job.descriptionPlain) ?? asString(job.descriptionHtml),
        location: asString(job.location),
        atsType: "ashby" as const,
      },
    ];
  });
}

interface WorkablePayload {
  jobs?: Array<{
    title?: string;
    url?: string;
    shortlink?: string;
    application_url?: string;
    city?: string;
    state?: string;
    country?: string;
    telecommuting?: boolean;
    description?: string;
  }>;
}

/**
 * Workable splits location across city/state/country with a separate
 * `telecommuting` flag rather than shipping one location string, so compose
 * one that classifyLocation() can actually read — without it, a remote US
 * role would land as "Unverified" purely for lack of the word "remote".
 */
function workableLocation(job: {
  city?: string;
  state?: string;
  country?: string;
  telecommuting?: boolean;
}): string | null {
  const parts = [
    job.telecommuting ? "Remote" : null,
    asString(job.city),
    asString(job.state),
    asString(job.country),
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function normalizeWorkable(
  payload: unknown,
  company: string,
): PostingCandidate[] {
  const jobs = (payload as WorkablePayload).jobs ?? [];
  return jobs.flatMap((job) => {
    const url =
      asString(job.url) ??
      asString(job.shortlink) ??
      asString(job.application_url);
    const title = asString(job.title);
    if (!url || !title) return [];
    return [
      {
        url,
        title,
        company,
        description: job.description ? decodeEntities(job.description) : null,
        location: workableLocation(job),
        atsType: "workable" as const,
      },
    ];
  });
}

interface RecruiteePayload {
  offers?: Array<{
    title?: string;
    careers_url?: string;
    careers_apply_url?: string;
    location?: string;
    city?: string;
    country?: string;
    remote?: boolean;
    description?: string;
    requirements?: string;
  }>;
}

export function normalizeRecruitee(
  payload: unknown,
  company: string,
): PostingCandidate[] {
  const offers = (payload as RecruiteePayload).offers ?? [];
  return offers.flatMap((offer) => {
    const url = asString(offer.careers_url) ?? asString(offer.careers_apply_url);
    const title = asString(offer.title);
    if (!url || !title) return [];
    // Recruitee keeps requirements in their own field; the AWS gate should
    // see them too, since "AWS" often appears only in requirements.
    const body = [asString(offer.description), asString(offer.requirements)]
      .filter((p): p is string => p !== null)
      .join("\n");
    const location =
      asString(offer.location) ??
      workableLocation({
        city: offer.city,
        country: offer.country,
        telecommuting: offer.remote,
      });
    return [
      {
        url,
        title,
        company,
        description: body ? decodeEntities(body) : null,
        location: offer.remote && location ? `Remote, ${location}` : location,
        atsType: "recruitee" as const,
      },
    ];
  });
}

export class BoardFetchError extends Error {
  constructor(
    readonly board: string,
    readonly status: number,
  ) {
    super(`Board ${board} responded ${status}`);
    this.name = "BoardFetchError";
  }
}

/** Fetch one board's postings via its public endpoint. */
export async function fetchBoard(
  atsType: AtsType,
  slug: string,
  displayName: string,
  fetchFn: typeof fetch = fetch,
): Promise<PostingCandidate[]> {
  const res = await fetchFn(buildBoardUrl(atsType, slug), {
    headers: { "user-agent": DISCOVERY_USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) throw new BoardFetchError(slug, res.status);
  const payload: unknown = await res.json();
  switch (atsType) {
    case "greenhouse":
      return normalizeGreenhouse(payload, displayName);
    case "lever":
      return normalizeLever(payload, displayName);
    case "ashby":
      return normalizeAshby(payload, displayName);
    case "workable":
      return normalizeWorkable(payload, displayName);
    case "recruitee":
      return normalizeRecruitee(payload, displayName);
  }
}
