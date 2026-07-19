import { apiOk } from "@/lib/api-response";
import { aiEnabled, aiModel } from "@/server/ai";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return apiOk({ enabled: aiEnabled(), model: aiEnabled() ? aiModel() : null });
}
