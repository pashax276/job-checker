import { z } from "zod";
import { getDb } from "@/db/client";
import { apiOk, apiZodError } from "@/lib/api-response";
import { listLeads } from "@/server/leads";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["new", "promoted", "dismissed"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return apiZodError(parsed.error);
  return apiOk(listLeads(getDb(), parsed.data.status));
}
