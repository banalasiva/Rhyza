import { handle, ok } from "@/lib/api";
import { requireUserId, requireSeedAccess } from "@/lib/authz";

// GET /api/seeds/:id/status — tiny poll target so an open seed can detect when
// someone else's vote bloomed it and play the celebration live for everyone.
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const seed = await requireSeedAccess(userId, ctx.params.id);
  return ok({ stage: seed.stage, bloomId: seed.bloomId });
});
