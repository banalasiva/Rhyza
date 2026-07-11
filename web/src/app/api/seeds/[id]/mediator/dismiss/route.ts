import { handle, ok } from "@/lib/api";
import { requireUserId, requireSeedAccess } from "@/lib/authz";
import { resolveMediatorNudge } from "@/lib/services/mediator";

export const dynamic = "force-dynamic";

// POST /api/seeds/:id/mediator/dismiss — "not now": clear the presence's live
// offer for everyone, without inviting it in.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await requireSeedAccess(userId, ctx.params.id);
  await resolveMediatorNudge(ctx.params.id);
  return ok({ ok: true });
});
