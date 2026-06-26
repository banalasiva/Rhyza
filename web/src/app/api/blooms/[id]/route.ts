import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getBloomDetail } from "@/lib/services/blooms";

// GET /api/blooms/:id — bloom detail + contributors + version history.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getBloomDetail(userId, ctx.params.id));
});
