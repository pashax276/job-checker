import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { watchlist } from "@/db/schema";
import { log } from "@/lib/log";
import {
  BoardFetchError,
  fetchBoard,
  type AtsType,
  type PostingCandidate,
} from "@/server/discovery/ats";
import { descriptionMatches, titleMatches } from "@/server/discovery/filters";
import { rssItemToCandidate, type FeedItem } from "@/server/discovery/rss";
import { createLeadIfNew, type LeadSource } from "@/server/leads";
import { getSetting, setSetting } from "@/server/settings";

export interface SourceCounts {
  fetched: number;
  matched: number;
  deduped: number;
  created: number;
}

export interface DiscoveryResult {
  startedAt: string;
  finishedAt: string;
  atsPoll: SourceCounts;
  alertsRss: SourceCounts;
  boardErrors: Array<{ board: string; status: number }>;
}

export interface RunDeps {
  fetchFn?: typeof fetch;
  parseFeed?: (url: string) => Promise<{ items: FeedItem[] }>;
  now?: Date;
}

const FAILURE_SKIP_THRESHOLD = 3;
const FAILURES_KEY = "boardFailureCounts";

const emptyCounts = (): SourceCounts => ({
  fetched: 0,
  matched: 0,
  deduped: 0,
  created: 0,
});

async function defaultParseFeed(url: string): Promise<{ items: FeedItem[] }> {
  const { default: Parser } = await import("rss-parser");
  const parser = new Parser();
  const feed = await parser.parseURL(url);
  return { items: feed.items ?? [] };
}

function ingest(
  db: DB,
  candidates: PostingCandidate[],
  source: LeadSource,
  counts: SourceCounts,
  now: Date,
  requireAws: boolean,
): void {
  for (const candidate of candidates) {
    counts.fetched += 1;
    if (!titleMatches(candidate.title)) continue;
    if (requireAws && !descriptionMatches(candidate.description)) continue;
    counts.matched += 1;
    const outcome = createLeadIfNew(db, candidate, source, now);
    if (outcome === "created") counts.created += 1;
    else counts.deduped += 1;
  }
}

/**
 * One idempotent discovery pass over both sources. Safe to re-run: dedupe
 * guarantees no duplicate leads. Boards are polled sequentially and a board
 * that keeps failing with 4xx is skipped until it succeeds again.
 */
export async function runDiscovery(
  db: DB,
  deps: RunDeps = {},
): Promise<DiscoveryResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const parseFeed = deps.parseFeed ?? defaultParseFeed;
  const now = deps.now ?? new Date();

  const result: DiscoveryResult = {
    startedAt: now.toISOString(),
    finishedAt: "",
    atsPoll: emptyCounts(),
    alertsRss: emptyCounts(),
    boardErrors: [],
  };

  // Source A — sequential ATS watchlist polling.
  const failures = getSetting<Record<string, number>>(db, FAILURES_KEY) ?? {};
  const boards = db.select().from(watchlist).where(eq(watchlist.enabled, true)).all();
  for (const board of boards) {
    if ((failures[board.boardSlug] ?? 0) >= FAILURE_SKIP_THRESHOLD) {
      log.warn(
        `discovery: skipping board ${board.boardSlug} after repeated failures`,
      );
      continue;
    }
    try {
      const candidates = await fetchBoard(
        board.atsType as AtsType,
        board.boardSlug,
        board.displayName,
        fetchFn,
      );
      failures[board.boardSlug] = 0;
      ingest(db, candidates, "ats-poll", result.atsPoll, now, true);
    } catch (err: unknown) {
      const status = err instanceof BoardFetchError ? err.status : 0;
      if (status >= 400 && status < 500) {
        failures[board.boardSlug] = (failures[board.boardSlug] ?? 0) + 1;
      }
      result.boardErrors = [
        ...result.boardErrors,
        { board: board.boardSlug, status },
      ];
      log.warn(`discovery: board ${board.boardSlug} failed (${status})`);
    }
  }
  setSetting(db, FAILURES_KEY, failures);

  // Source B — Google Alerts RSS feeds (the new-company channel).
  const feeds = getSetting<string[]>(db, "rssFeeds") ?? [];
  for (const feedUrl of feeds) {
    try {
      const { items } = await parseFeed(feedUrl);
      const candidates = items
        .map(rssItemToCandidate)
        .filter((c): c is PostingCandidate => c !== null);
      // Alerts carry no posting body, so the AWS description gate is skipped.
      ingest(db, candidates, "alerts-rss", result.alertsRss, now, false);
    } catch (err: unknown) {
      log.warn(
        `discovery: feed failed ${feedUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  result.finishedAt = new Date().toISOString();
  setSetting(db, "lastDiscoveryRun", result);
  return result;
}
