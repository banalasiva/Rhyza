import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// POST /api/gardens/:id/pin — toggle "pin this garden to the top of my Home".
// Per-user only; returns the new pinned state.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const gardenId = ctx.params.id;
  const existing = await db.gardenPin
    .findUnique({ where: { userId_gardenId: { userId, gardenId } } })
    .catch(() => null);
  if (existing) {
    await db.gardenPin.delete({ where: { userId_gardenId: { userId, gardenId } } });
    return ok({ pinned: false });
  }
  await db.gardenPin.create({ data: { userId, gardenId } });
  return ok({ pinned: true });
});
