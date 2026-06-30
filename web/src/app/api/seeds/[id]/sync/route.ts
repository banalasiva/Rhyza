import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getSeedSync } from "@/lib/services/seeds";

// GET /api/seeds/:id/sync — a live snapshot of the open room: the full current
// contributions (with reactions/edits/endorsements), the readiness distribution
// and the viewer's own stage vote. Polled by the seed page so everyone sees each
// other's activity without a manual refresh.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getSeedSync(userId, ctx.params.id));
});
