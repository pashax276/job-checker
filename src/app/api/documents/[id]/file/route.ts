import { getDb } from "@/db/client";
import { apiError } from "@/lib/api-response";
import { getDocument, readDocumentFile } from "@/server/documents";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const record = getDocument(getDb(), id);
  if (!record) return apiError(`Document ${id} not found`, 404);
  const data = readDocumentFile(id);
  if (!data) return apiError("Stored file is missing", 404);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": record.mimeType,
      "content-disposition": `attachment; filename="${record.fileName.replaceAll('"', "")}"`,
    },
  });
}
