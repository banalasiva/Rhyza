import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// POST /api/seeds/:id/dismiss — hide this seed from MY Home (never affects anyone
// else, never leaves the decision). It reappears if the seed gets new activity
// after now. DELETE un-hides it.
export const POST = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const seedId = ctx.params.id;
  await db.seedDismissal.upsert({
    where: { userId_seedId: { userId, seedId } },
    update: { createdAt: new Date() }, // re-hide from now, even if it had resurfaced
    create: { userId, seedId },
  });
  return ok({ dismissed: true });
});

export const DELETE = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  await db.seedDismissal.deleteMany({ where: { userId, seedId: ctx.params.id } });
  return ok({ dismissed: false });
});
