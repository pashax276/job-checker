import { getDb } from "@/db/client";
import { apiError, apiOk } from "@/lib/api-response";
import { deleteActivity } from "@/server/activity";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!deleteActivity(getDb(), id)) {
    return apiError(`Activity entry ${id} not found`, 404);
  }
  return apiOk({ deleted: id });
}
