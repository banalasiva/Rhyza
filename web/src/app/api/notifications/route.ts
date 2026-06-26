import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { db } from "@/lib/db";

// GET /api/notifications — recent notifications, unread first.
export const GET = handle(async () => {
  const userId = await requireUserId();
  const notifications = await db.notification.findMany({
    where: { recipientId: userId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { actor: { select: { name: true, image: true } } },
  });
  return ok({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      entityType: n.entityType,
      entityId: n.entityId,
      actor: n.actor,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  });
});
