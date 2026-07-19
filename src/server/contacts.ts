import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { contacts, type ContactRecord } from "@/db/schema";
import type { ContactCreate, ContactPatch } from "@/lib/schemas";

export function listContacts(db: DB, jobId: string): ContactRecord[] {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.jobId, jobId))
    .orderBy(asc(contacts.createdAt))
    .all();
}

export function addContact(
  db: DB,
  jobId: string,
  input: ContactCreate,
  now = new Date(),
): ContactRecord {
  const record: ContactRecord = {
    id: randomUUID(),
    jobId,
    name: input.name,
    role: input.role,
    email: input.email,
    phone: input.phone,
    lastTouch: input.lastTouch,
    createdAt: now.toISOString(),
  };
  db.insert(contacts).values(record).run();
  return record;
}

export function updateContact(
  db: DB,
  id: string,
  patch: ContactPatch,
): ContactRecord | null {
  const current = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!current) return null;
  const next = { ...current, ...patch };
  db.update(contacts).set(next).where(eq(contacts.id, id)).run();
  return next;
}

export function deleteContact(db: DB, id: string): boolean {
  return db.delete(contacts).where(eq(contacts.id, id)).run().changes > 0;
}
