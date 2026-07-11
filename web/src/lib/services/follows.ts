import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { deliver } from "@/lib/services/notify";
import { appUrl } from "@/lib/email";

// ── The people graph ──────────────────────────────────────────────────────

// Follow a person (one-directional, no approval). Idempotent. Pings the followed
// person once so the connection feels mutual even though it isn't gated.
export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) throw new ApiError("BAD_REQUEST", "You can't follow yourself.");
  const target = await db.user.findUnique({
    where: { id: followingId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!target || target.deletedAt) throw new ApiError("NOT_FOUND", "Person not found.");

  const existing = await db.userFollow
    .findUnique({ where: { followerId_followingId: { followerId, followingId } }, select: { followerId: true } })
    .catch(() => null);
  await db.userFollow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    update: {},
    create: { followerId, followingId },
  });

  // Notify the followed person the first time only.
  if (!existing) {
    try {
      const me = await db.user.findUnique({ where: { id: followerId }, select: { name: true } });
      const who = me?.name || "Someone";
      const notif = await db.notification.create({
        data: {
          recipientId: followingId,
          actorId: followerId,
          type: "follow",
          title: `${who} is following you ✦`,
          body: "They'll hear when you share your thinking in public.",
          entityType: "user",
          entityId: followerId,
        },
        select: { id: true },
      });
      await deliver([
        {
          notificationId: notif.id,
          recipientId: followingId,
          type: "follow",
          push: { title: `${who} is following you ✦`, body: "Tap to see their profile." },
          link: `/u/${followerId}`,
        },
      ]);
    } catch (err) {
      console.error("followUser notify failed", err);
    }
  }
  return { following: true };
}

export async function unfollowUser(followerId: string, followingId: string) {
  await db.userFollow.deleteMany({ where: { followerId, followingId } });
  return { following: false };
}

// Counts + whether the viewer follows this person — for the profile.
export async function getFollowContext(
  userId: string,
  viewerId?: string,
): Promise<{ followers: number; following: number; isFollowing: boolean }> {
  try {
    const [followers, following, mine] = await Promise.all([
      db.userFollow.count({ where: { followingId: userId } }),
      db.userFollow.count({ where: { followerId: userId } }),
      viewerId && viewerId !== userId
        ? db.userFollow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
            select: { followerId: true },
          })
        : Promise.resolve(null),
    ]);
    return { followers, following, isFollowing: !!mine };
  } catch {
    return { followers: 0, following: 0, isFollowing: false }; // table not migrated yet
  }
}

// ── "Someone you follow did something public" notifications ────────────────

// Fan a public action out to the actor's followers. Best-effort; never throws,
// so it can't break the action that triggered it. Excludes the actor and anyone
// already notified about this (e.g. the seed's own participants).
export async function notifyFollowersOf(
  actorId: string,
  opts: {
    type: string;
    title: string;
    body: string;
    entityType: string;
    entityId: string;
    link: string;
    pushTitle: string;
    exclude?: string[];
  },
): Promise<void> {
  try {
    const rows = await db.userFollow
      .findMany({ where: { followingId: actorId }, select: { followerId: true }, take: 5000 })
      .catch(() => [] as { followerId: string }[]);
    const exclude = new Set<string>([actorId, ...(opts.exclude ?? [])]);
    const ids: string[] = [
      ...new Set((rows as { followerId: string }[]).map((r) => r.followerId)),
    ].filter((id) => !exclude.has(id));
    if (ids.length === 0) return;

    await db.notification.createMany({
      data: ids.map((recipientId) => ({
        recipientId,
        actorId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        entityType: opts.entityType,
        entityId: opts.entityId,
      })),
    });
    const created = await db.notification.findMany({
      where: { actorId, type: opts.type, entityType: opts.entityType, entityId: opts.entityId, recipientId: { in: ids } },
      select: { id: true, recipientId: true },
    });
    await deliver(
      created.map((n) => ({
        notificationId: n.id,
        recipientId: n.recipientId,
        type: opts.type,
        push: { title: opts.pushTitle, body: opts.body },
        link: opts.link,
      })),
    );
  } catch (err) {
    console.error("notifyFollowersOf failed", err);
  }
}

// A person you follow planted a new PUBLIC seed (a public garden) — high signal.
export async function notifyFollowersNewSeed(
  actorId: string,
  seed: { id: string; title: string; gardenId: string },
): Promise<void> {
  try {
    const garden = await db.garden
      .findUnique({ where: { id: seed.gardenId }, select: { visibility: true } })
      .catch(() => null);
    if ((garden as { visibility?: string } | null)?.visibility !== "public") return; // world-visible only
    const me = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });
    const who = me?.name || "Someone";
    await notifyFollowersOf(actorId, {
      type: "network",
      title: `${who} planted a new seed 🌱`,
      body: seed.title,
      entityType: "seed",
      entityId: seed.id,
      link: `/seeds/${seed.id}`,
      pushTitle: `${who} planted a new seed 🌱`,
    });
  } catch (err) {
    console.error("notifyFollowersNewSeed failed", err);
  }
}

// A new seed was planted in a garden — tell the garden's OTHER members ("Siva
// planted a new seed in Home & family"). This is the everyday "there's a new
// question to weigh in on" nudge for the group, distinct from the followers hook
// above. Only for garden-visible (public-visibility) seeds, so a private seed
// never leaks to members who can't open it. Best-effort.
export async function notifyGardenNewSeed(
  actorId: string,
  seed: { id: string; title: string; gardenId: string },
): Promise<void> {
  try {
    const [garden, members, me] = await Promise.all([
      db.garden.findUnique({ where: { id: seed.gardenId }, select: { name: true } }).catch(() => null),
      db.gardenMember
        .findMany({ where: { gardenId: seed.gardenId, userId: { not: actorId } }, select: { userId: true } })
        .catch(() => [] as { userId: string }[]),
      db.user.findUnique({ where: { id: actorId }, select: { name: true } }),
    ]);
    const recipients = [...new Set((members as { userId: string }[]).map((m) => m.userId))];
    if (recipients.length === 0) return;
    const who = me?.name || "Someone";
    const gardenName = (garden as { name?: string } | null)?.name || "your garden";
    const title = `${who} planted a new seed 🌱`;
    const body = `“${seed.title}” in ${gardenName}`;
    const start = new Date();
    await db.notification.createMany({
      data: recipients.map((rid) => ({
        recipientId: rid,
        actorId,
        type: "new_seed",
        title,
        body,
        entityType: "seed",
        entityId: seed.id,
      })),
    });
    const rows = await db.notification.findMany({
      where: { type: "new_seed", entityId: seed.id, actorId, recipientId: { in: recipients }, createdAt: { gte: start } },
      select: { id: true, recipientId: true },
    });
    await deliver(
      (rows as { id: string; recipientId: string }[]).map((r) => ({
        notificationId: r.id,
        recipientId: r.recipientId,
        type: "new_seed",
        push: { title, body },
        link: `/seeds/${seed.id}`,
      })),
    );
  } catch (err) {
    console.error("notifyGardenNewSeed failed", err);
  }
}

// A person you follow just JOINED a public discussion (their first message on it)
// — the "they're thinking about this too" hook. Fires once per seed per person,
// only for world-visible seeds, so it never becomes per-comment spam.
export async function notifyFollowersJoinedDiscussion(
  actorId: string,
  actorName: string | null,
  seed: { id: string; title: string; gardenId: string; listed: boolean },
  isFirstOnThisSeed: boolean,
): Promise<void> {
  if (!isFirstOnThisSeed) return;
  try {
    let worldVisible = seed.listed;
    if (!worldVisible) {
      const garden = await db.garden
        .findUnique({ where: { id: seed.gardenId }, select: { visibility: true } })
        .catch(() => null);
      worldVisible = (garden as { visibility?: string } | null)?.visibility === "public";
    }
    if (!worldVisible) return;
    const who = actorName || "Someone";
    await notifyFollowersOf(actorId, {
      type: "network",
      title: `${who} weighed in 💬`,
      body: `On “${seed.title}”`,
      entityType: "seed",
      entityId: seed.id,
      link: `/seeds/${seed.id}`,
      pushTitle: `${who} joined a discussion 💬`,
    });
  } catch (err) {
    console.error("notifyFollowersJoinedDiscussion failed", err);
  }
}

// Convenience: the absolute URL base (used by callers building links).
export function base() {
  return appUrl();
}
