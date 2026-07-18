import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { settings } from "@/db/schema";

/** JSON-typed key/value settings store. */
export function getSetting<T>(db: DB, key: string): T | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function setSetting(db: DB, key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: serialized })
    .onConflictDoUpdate({ target: settings.key, set: { value: serialized } })
    .run();
}
