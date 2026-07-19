import { z } from "zod";
import { getDb } from "@/db/client";
import { apiError, apiOk, apiZodError } from "@/lib/api-response";
import { computeReminders, dismissReminder } from "@/server/reminders";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return apiOk(computeReminders(getDb()));
}

const dismissSchema = z.strictObject({
  key: z.string().min(1),
  action: z.literal("dismiss"),
});

export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON", 400);
  }
  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) return apiZodError(parsed.error);
  dismissReminder(getDb(), parsed.data.key);
  return apiOk({ dismissed: parsed.data.key });
}
