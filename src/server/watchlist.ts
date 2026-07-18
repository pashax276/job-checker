import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { watchlist, type WatchlistRecord } from "@/db/schema";
import type { WatchlistCreate, WatchlistPatch } from "@/lib/discovery-schemas";

export function listWatchlist(db: DB): WatchlistRecord[] {
  return db.select().from(watchlist).orderBy(asc(watchlist.displayName)).all();
}

export function createWatchlistEntry(
  db: DB,
  input: WatchlistCreate,
): WatchlistRecord {
  const record: WatchlistRecord = { id: randomUUID(), ...input };
  db.insert(watchlist).values(record).run();
  return record;
}

export function updateWatchlistEntry(
  db: DB,
  id: string,
  patch: WatchlistPatch,
): WatchlistRecord | null {
  const current = db.select().from(watchlist).where(eq(watchlist.id, id)).get();
  if (!current) return null;
  const next = { ...current, ...patch };
  db.update(watchlist).set(next).where(eq(watchlist.id, id)).run();
  return next;
}

export function deleteWatchlistEntry(db: DB, id: string): boolean {
  return db.delete(watchlist).where(eq(watchlist.id, id)).run().changes > 0;
}
