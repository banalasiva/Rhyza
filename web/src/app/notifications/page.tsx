import Link from "next/link";
import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { NavBar } from "@/components/NavBar";

function href(entityType: string | null, entityId: string | null): string {
  if (!entityId) return "/";
  if (entityType === "seed") return `/seeds/${entityId}`;
  if (entityType === "bloom") return `/blooms/${entityId}`;
  if (entityType === "garden") return `/gardens/${entityId}`;
  return "/";
}

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const notifications = await db.notification.findMany({
    where: { recipientId: viewer.userId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
  // Mark everything read on view so the bell badge clears.
  await db.notification.updateMany({
    where: { recipientId: viewer.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <Link href="/" className="btn-ghost mb-5 inline-flex px-3 py-1.5 text-xs">
          ← Your gardens
        </Link>
        <h1 className="serif-xl mb-6">🔔 Notifications</h1>
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing yet. Go plant something. 🌱</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={href(n.entityType, n.entityId)}
                  className={`card block p-4 ${n.readAt ? "opacity-60" : ""}`}
                >
                  <p className="text-sm text-ink">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-ink-mid">{n.body}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
