import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// Inline queries (no shared/`as const` args object) so Prisma infers the
// orderBy/select literal types — and the return type — correctly. The try/catch
// lets this survive a DB where the anchor_id column hasn't been migrated yet.
async function loadRows(userId: string) {
  try {
    return await db.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        anchorId: true,
        readAt: true,
        createdAt: true,
        actor: { select: { name: true, image: true } },
      },
    });
  } catch {
    const base = await db.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        readAt: true,
        createdAt: true,
        actor: { select: { name: true, image: true } },
      },
    });
    return base.map((r) => ({ ...r, anchorId: null as string | null }));
  }
}

// POST /api/notifications — mark all of the viewer's notifications read (clears
// the bell badge). Called from the Notifications page AFTER it paints, so the
// list can render instantly (showing which were unread) without a blocking
// write gating the server render.
export const POST = handle(async () => {
  const userId = await requireUserId();
  await db.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
});

// GET /api/notifications — recent notifications, unread first.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const rows = await loadRows(userId);
  return ok({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      entityType: n.entityType,
      entityId: n.entityId,
      anchorId: n.anchorId,
      actor: n.actor,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  });
});
