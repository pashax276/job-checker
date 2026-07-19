import type { DocumentRecord } from "@/db/schema";
import type { DocumentKind } from "@/server/documents";

export interface DocumentDto {
  id: string;
  kind: DocumentKind;
  name: string;
  fileName: string;
  mimeType: string;
  bullets: string[];
  skills: string[];
  createdAt: string;
}

export function toDto(record: DocumentRecord): DocumentDto {
  return {
    id: record.id,
    kind: record.kind as DocumentKind,
    name: record.name,
    fileName: record.fileName,
    mimeType: record.mimeType,
    bullets: JSON.parse(record.bullets ?? "[]") as string[],
    skills: JSON.parse(record.skills ?? "[]") as string[],
    createdAt: record.createdAt,
  };
}
