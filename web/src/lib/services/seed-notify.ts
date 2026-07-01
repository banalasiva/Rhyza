import { db } from "@/lib/db";
import { deliver } from "@/lib/services/notify";

// Notify everyone involved in a seed — its creator, contributors, members and
// followers — minus the actor (and anyone explicitly excluded). Creates the
// in-app notifications and fans them out over push. Fire-and-forget safe: it
// swallows its own errors so it can never break the action that triggered it.
export async function notifySeedAudience(opts: {
  actorId: string;
  seed: { id: string; title: string; createdById: string };
  type: string;
  title: string;
  body: string;
  exclude?: string[];
}) {
  const { actorId, seed, type, title, body } = opts;
  try {
    const start = new Date();
    const [participants, follows, members] = await Promise.all([
      db.contribution.findMany({
        where: { seedId: seed.id, deletedAt: null },
        distinct: ["authorId"],
        select: { authorId: true },
      }),
      db.seedFollow.findMany({ where: { seedId: seed.id }, select: { userId: true } }).catch(() => []),
      db.seedMember.findMany({ where: { seedId: seed.id }, select: { userId: true } }),
    ]);

    const exclude = new Set<string>([actorId, ...(opts.exclude ?? [])]);
    const recipients = new Set<string>();
    const add = (id?: string | null) => {
      if (id && !exclude.has(id)) recipients.add(id);
    };
    add(seed.createdById);
    for (const p of participants as { authorId: string }[]) add(p.authorId);
    for (const f of follows as { userId: string }[]) add(f.userId);
    for (const m of members as { userId: string }[]) add(m.userId);
    if (recipients.size === 0) return;

    const ids = [...recipients];
    await db.notification.createMany({
      data: ids.map((rid) => ({
        recipientId: rid,
        actorId,
        type,
        title,
        body,
        entityType: "seed",
        entityId: seed.id,
      })),
    });
    // Read back exactly the rows we just made (same actor + seed, after `start`)
    // so push delivery stamps the right notifications.
    const rows = await db.notification.findMany({
      where: { type, entityId: seed.id, actorId, recipientId: { in: ids }, createdAt: { gte: start } },
      select: { id: true, recipientId: true },
    });
    await deliver(
      (rows as { id: string; recipientId: string }[]).map((r) => ({
        notificationId: r.id,
        recipientId: r.recipientId,
        type,
        push: { title, body },
        link: `/seeds/${seed.id}`,
      })),
    );
  } catch (err) {
    console.error("notifySeedAudience failed", err);
  }
}
