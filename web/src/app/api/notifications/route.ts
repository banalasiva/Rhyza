import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// Explicit field list (anchorId added in a try below) so this survives even if
// the anchor_id migration hasn't been applied to this database yet.
const SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  entityType: true,
  entityId: true,
  readAt: true,
  createdAt: true,
  actor: { select: { name: true, image: true } },
} as const;

// GET /api/notifications — recent notifications, unread first.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const args = {
    where: { recipientId: userId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }] as const,
    take: 50,
  };
  let rows;
  try {
    rows = await db.notification.findMany({ ...args, select: { ...SELECT, anchorId: true } });
  } catch {
    const base = await db.notification.findMany({ ...args, select: SELECT });
    rows = base.map((r) => ({ ...r, anchorId: null as string | null }));
  }
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
