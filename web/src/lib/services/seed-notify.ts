import { db } from "@/lib/db";
import { deliver } from "@/lib/services/notify";
import { displayName } from "@/lib/display-name";

// Announce, IN the seed thread, that someone just joined — whether they were
// added from a circle, accepted an invite link, or were approved to join. Posts
// a small "system" contribution authored by the joiner (so they immediately
// count as a member and the count updates live), and notifies the rest of the
// room. Idempotent: never announces the same person's join twice.
export async function announceJoin(seedId: string, userId: string) {
  try {
    const existing = await db.contribution.findFirst({
      where: { seedId, authorId: userId, dimension: "system", deletedAt: null },
      select: { id: true },
    });
    if (existing) return;
    const [seed, user] = await Promise.all([
      db.seed.findUnique({ where: { id: seedId }, select: { id: true, title: true, createdById: true } }),
      db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ]);
    if (!seed) return;
    await db.contribution.create({
      data: { seedId, authorId: userId, dimension: "system", content: { system: "join", text: "" } },
    });
    await db.seed.update({ where: { id: seedId }, data: { lastActivityAt: new Date() } }).catch(() => {});
    const name = displayName(user ?? {});
    await notifySeedAudience({
      actorId: userId,
      seed,
      type: "member_joined",
      title: `${name} joined “${seed.title.slice(0, 60)}”`,
      body: `${name} is in the conversation now 🌱`,
    });
  } catch (err) {
    console.error("announceJoin failed", err);
  }
}

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
