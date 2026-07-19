import { z } from "zod";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { createDocument, listDocuments } from "@/server/documents";
import { toDto } from "@/server/documents-dto";

export const dynamic = "force-dynamic";

const kindSchema = z.enum(["resume", "cover-letter"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

export async function GET(request: Request): Promise<Response> {
  const kindParam = new URL(request.url).searchParams.get("kind");
  const kind = kindParam ? kindSchema.safeParse(kindParam) : null;
  if (kind && !kind.success) return apiZodError(kind.error);
  return apiOk(listDocuments(getDb(), kind?.data).map(toDto));
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Expected multipart form data", 400);
  }
  const kind = kindSchema.safeParse(form.get("kind"));
  if (!kind.success) return apiZodError(kind.error);
  const name = String(form.get("name") ?? "").trim();
  if (!name) return apiError("Version name is required", 400);
  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("Missing file upload (field name: file)", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return apiError("File too large (10MB max)", 400);
  }
  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return apiError(
      `Unsupported file type — use ${ALLOWED_EXTENSIONS.join(", ")}`,
      400,
    );
  }
  const record = await createDocument(getDb(), {
    kind: kind.data,
    name,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    data: Buffer.from(await file.arrayBuffer()),
  });
  return apiOk(toDto(record), 201);
}
