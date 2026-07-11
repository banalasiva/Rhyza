import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { NotificationSettings } from "@/components/NotificationSettings";
import { NotificationList } from "@/components/NotificationList";
import { NotificationFix } from "@/components/NotificationFix";

function href(
  entityType: string | null,
  entityId: string | null,
  anchorId?: string | null,
): string {
  if (!entityId) return "/";
  // Jump to the exact message when we know it (mentions / new contributions).
  const anchor = anchorId ? `#c-${anchorId}` : "";
  if (entityType === "seed") return `/seeds/${entityId}${anchor}`;
  if (entityType === "bloom") return `/blooms/${entityId}`;
  if (entityType === "garden") return `/gardens/${entityId}`;
  return "/";
}

// Inline queries (no shared/`as const` args) so Prisma infers orderBy/select —
// and the return type — correctly. The try/catch lets the page survive a DB
// where the anchor_id column hasn't been migrated yet (no deep-link then).
async function loadNotifications(userId: string) {
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
      },
    });
  } catch {
    const rows = await db.notification.findMany({
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
      },
    });
    return rows.map((r) => ({ ...r, anchorId: null }));
  }
}

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const [notifications, prefs] = await Promise.all([
    loadNotifications(viewer.userId),
    db.user.findUnique({
      where: { id: viewer.userId },
      select: { emailNotify: true, pushNotify: true, digestNotify: true },
    }),
  ]);
  // Mark everything read on view so the bell badge clears.
  await db.notification.updateMany({
    where: { recipientId: viewer.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>
        <h1 className="serif-xl mb-6">🔔 Notifications</h1>
        <NotificationFix />
        <NotificationSettings
          initial={prefs ?? { emailNotify: true, pushNotify: true, digestNotify: true }}
        />
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing yet. Go plant something. 🌱</p>
        ) : (
          <NotificationList
            items={notifications.map((n) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              href: href(n.entityType, n.entityId, n.anchorId),
              unread: !n.readAt,
            }))}
          />
        )}
      </main>
    </div>
  );
}
