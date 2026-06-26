import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getSeedDetail } from "@/lib/services/seeds";

// GET /api/seeds/:id — seed detail + stage distribution + contributions.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getSeedDetail(userId, ctx.params.id));
});
