import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { forceBloom, revertBloom, reopenBloom } from "@/lib/services/blooms";

// POST /api/seeds/:id/bloom — manually bloom now (author/steward), bypassing the
// vote threshold.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const bloom = await forceBloom(userId, ctx.params.id);
  return ok({ bloomId: bloom.id, gardenId: bloom.gardenId }, 201);
});

// DELETE /api/seeds/:id/bloom — revert the bloom, re-opening the seed
// (author/steward only).
export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await revertBloom(userId, ctx.params.id));
});

// PATCH /api/seeds/:id/bloom — reopen to evolve: keep the bloom as history and
// reactivate the seed so it can grow into a new version (author/steward only).
export const PATCH = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await reopenBloom(userId, ctx.params.id));
});
