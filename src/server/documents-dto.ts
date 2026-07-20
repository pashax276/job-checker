import type { DocumentRecord } from "@/db/schema";
import type { ExperienceEntry } from "@/lib/resume-parse";
import type { DocumentKind } from "@/server/documents";

export interface DocumentDto {
  id: string;
  kind: DocumentKind;
  name: string;
  fileName: string;
  mimeType: string;
  bullets: string[];
  skills: string[];
  experience: ExperienceEntry[];
  textExcerpt: string;
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
    experience: JSON.parse(record.experience ?? "[]") as ExperienceEntry[],
    textExcerpt: record.extractedText.slice(0, 2_500),
    createdAt: record.createdAt,
  };
}
