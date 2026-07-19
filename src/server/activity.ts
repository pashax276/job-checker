import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { activity, type ActivityRecord } from "@/db/schema";
import type { ActivityCreate } from "@/lib/schemas";

export function listActivity(db: DB, jobId: string): ActivityRecord[] {
  return db
    .select()
    .from(activity)
    .where(eq(activity.jobId, jobId))
    .orderBy(desc(activity.createdAt))
    .all();
}

export function addActivity(
  db: DB,
  jobId: string,
  input: ActivityCreate,
  now = new Date(),
): ActivityRecord {
  const record: ActivityRecord = {
    id: randomUUID(),
    jobId,
    note: input.note,
    createdAt: now.toISOString(),
  };
  db.insert(activity).values(record).run();
  return record;
}

export function deleteActivity(db: DB, id: string): boolean {
  return db.delete(activity).where(eq(activity.id, id)).run().changes > 0;
}
