import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// POST /api/gardens/:id/pin — set whether this garden is pinned to the top of MY
// Home. Idempotent: send { pinned: true|false } (defaults to true) so the client
// stays the source of truth and the two never desync. Per-user only.
export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const gardenId = ctx.params.id;
  const body = (await req.json().catch(() => ({}))) as { pinned?: boolean };
  const pinned = body.pinned !== false; // default to pinning
  if (pinned) {
    await db.gardenPin.upsert({
      where: { userId_gardenId: { userId, gardenId } },
      update: {},
      create: { userId, gardenId },
    });
  } else {
    await db.gardenPin.deleteMany({ where: { userId, gardenId } });
  }
  return ok({ pinned });
});
