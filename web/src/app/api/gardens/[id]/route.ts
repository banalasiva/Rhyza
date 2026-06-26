import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getGardenDetail } from "@/lib/services/gardens";

// GET /api/gardens/:id — garden detail + open seeds.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getGardenDetail(userId, ctx.params.id));
});
