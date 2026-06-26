import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getSacredTree } from "@/lib/services/gardens";

// GET /api/gardens/:id/sacred-tree — all blooms as tree leaves.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok({ blooms: await getSacredTree(userId, ctx.params.id) });
});
