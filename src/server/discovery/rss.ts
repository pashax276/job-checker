import type { PostingCandidate } from "@/server/discovery/ats";

/** Google Alerts links wrap the target in a /url?url= redirect. */
export function extractTargetUrl(link: string): string {
  try {
    const parsed = new URL(link);
    if (parsed.hostname.endsWith("google.com") && parsed.pathname === "/url") {
      const target = parsed.searchParams.get("url") ?? parsed.searchParams.get("q");
      if (target) return target;
    }
    return link;
  } catch {
    return link;
  }
}

export function detectAtsType(
  url: string,
): "greenhouse" | "lever" | "ashby" | "workday" | null {
  if (/boards\.greenhouse\.io|greenhouse\.io\/embed/i.test(url)) return "greenhouse";
  if (/jobs\.lever\.co/i.test(url)) return "lever";
  if (/jobs\.ashbyhq\.com/i.test(url)) return "ashby";
  if (/myworkdayjobs\.com/i.test(url)) return "workday";
  return null;
}

/** Best-effort company slug from well-known ATS URL shapes; null when unknown. */
export function companySlugFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (/boards\.greenhouse\.io/i.test(parsed.hostname)) return segments[0] ?? null;
    if (/jobs\.lever\.co/i.test(parsed.hostname)) return segments[0] ?? null;
    if (/jobs\.ashbyhq\.com/i.test(parsed.hostname)) return segments[0] ?? null;
    const workday = parsed.hostname.match(/^([^.]+)\.wd\d+\.myworkdayjobs\.com$/i);
    if (workday) return workday[1];
    return null;
  } catch {
    return null;
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export interface FeedItem {
  title?: string;
  link?: string;
}

/** Convert a Google Alerts feed item into a lead candidate (or null). */
export function rssItemToCandidate(item: FeedItem): PostingCandidate | null {
  if (!item.link || !item.title) return null;
  const url = extractTargetUrl(item.link);
  return {
    url,
    title: stripHtml(item.title),
    company: companySlugFromUrl(url),
    description: null, // alerts carry no posting body — filters skip the AWS gate
    location: null, // never guess: alerts don't state location
    atsType: detectAtsType(url),
  };
}
