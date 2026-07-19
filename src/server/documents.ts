import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { documents, type DocumentRecord } from "@/db/schema";
import { log } from "@/lib/log";
import {
  extractBullets,
  extractExperience,
  extractSkills,
} from "@/lib/resume-parse";

export type DocumentKind = "resume" | "cover-letter";

export function documentsDir(): string {
  return (
    process.env.DOCUMENTS_DIR ?? path.join(process.cwd(), "data", "files")
  );
}

export interface DocumentUpload {
  kind: DocumentKind;
  name: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

/**
 * pdfjs' legacy build imports DOM drawing globals at module scope; when the
 * optional @napi-rs/canvas is unavailable it throws before we can extract
 * text (which needs none of them). Stub just enough to load.
 */
function ensurePdfDomGlobals(): void {
  for (const name of ["DOMMatrix", "ImageData", "Path2D"]) {
    if (!(name in globalThis)) {
      Reflect.set(globalThis, name, class {});
    }
  }
}

async function extractText(upload: DocumentUpload): Promise<string> {
  const lower = upload.fileName.toLowerCase();
  try {
    if (lower.endsWith(".pdf") || upload.mimeType === "application/pdf") {
      ensurePdfDomGlobals();
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(upload.data) });
      const result = await parser.getText();
      return result.text ?? "";
    }
    if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: upload.data });
      return result.value ?? "";
    }
    return upload.data.toString("utf8");
  } catch (err: unknown) {
    // Best-effort: the file is still stored — but never fail silently again
    // (a swallowed bundler error once cost a whole feature).
    log.error(
      `text extraction failed for ${upload.fileName}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return "";
  }
}

export async function createDocument(
  db: DB,
  upload: DocumentUpload,
  dir = documentsDir(),
): Promise<DocumentRecord> {
  const id = randomUUID();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id), upload.data);

  const text = await extractText(upload);
  const record: DocumentRecord = {
    id,
    kind: upload.kind,
    name: upload.name,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    extractedText: text,
    bullets: JSON.stringify(extractBullets(text)),
    skills: JSON.stringify(extractSkills(text)),
    experience: JSON.stringify(extractExperience(text)),
    createdAt: new Date().toISOString(),
  };
  db.insert(documents).values(record).run();
  return record;
}

/**
 * Re-run extraction from the stored file (e.g. after a parser fix). Manually
 * added skills are preserved — extracted and manual sets are merged.
 */
export async function reparseDocument(
  db: DB,
  id: string,
  dir = documentsDir(),
): Promise<DocumentRecord | null> {
  const current = getDocument(db, id);
  if (!current) return null;
  const data = readDocumentFile(id, dir);
  if (!data) throw new Error("Stored file is missing");

  const text = await extractText({
    kind: current.kind as DocumentKind,
    name: current.name,
    fileName: current.fileName,
    mimeType: current.mimeType,
    data,
  });
  const manualSkills = JSON.parse(current.skills ?? "[]") as string[];
  const mergedSkills = [
    ...new Set([...extractSkills(text), ...manualSkills]),
  ];
  const next: DocumentRecord = {
    ...current,
    extractedText: text,
    bullets: JSON.stringify(extractBullets(text)),
    skills: JSON.stringify(mergedSkills),
    experience: JSON.stringify(extractExperience(text)),
  };
  db.update(documents).set(next).where(eq(documents.id, id)).run();
  return next;
}

export function listDocuments(db: DB, kind?: DocumentKind): DocumentRecord[] {
  const query = db.select().from(documents);
  return (
    kind
      ? query.where(eq(documents.kind, kind))
      : query
  )
    .orderBy(desc(documents.createdAt))
    .all();
}

export function getDocument(db: DB, id: string): DocumentRecord | null {
  return db.select().from(documents).where(eq(documents.id, id)).get() ?? null;
}

export function updateDocument(
  db: DB,
  id: string,
  patch: { name?: string; skills?: string[] },
): DocumentRecord | null {
  const current = getDocument(db, id);
  if (!current) return null;
  const next: DocumentRecord = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.skills !== undefined ? { skills: JSON.stringify(patch.skills) } : {}),
  };
  db.update(documents).set(next).where(eq(documents.id, id)).run();
  return next;
}

export function deleteDocument(db: DB, id: string, dir = documentsDir()): boolean {
  const removed = db.delete(documents).where(eq(documents.id, id)).run().changes > 0;
  if (removed) {
    fs.rmSync(path.join(dir, id), { force: true });
  }
  return removed;
}

export function readDocumentFile(id: string, dir = documentsDir()): Buffer | null {
  const filePath = path.join(dir, id);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}
