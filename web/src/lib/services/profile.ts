import { db } from "@/lib/db";
import { EXPLORE_TOPICS } from "@/lib/constants";

const TOPIC_BY_KEY = new Map(EXPLORE_TOPICS.map((t) => [t.key as string, t]));

// The topics a person is involved in — inferred automatically by Claude (it
// tags each seed with topics), then aggregated across every seed they created
// or contributed to. Ranked by how often they show up, top 8.
export async function getInvolvedTopics(
  userId: string,
): Promise<{ key: string; label: string; emoji: string }[]> {
  const [created, contributed] = await Promise.all([
    db.seed.findMany({ where: { createdById: userId, deletedAt: null }, select: { id: true }, take: 500 }),
    db.contribution.findMany({
      where: { authorId: userId, deletedAt: null },
      distinct: ["seedId"],
      select: { seedId: true },
      take: 500,
    }),
  ]);
  const ids = [
    ...new Set([...created.map((s) => s.id), ...contributed.map((c) => c.seedId)]),
  ];
  if (ids.length === 0) return [];

  const grouped = await db.seedTopic
    .groupBy({
      by: ["topic"],
      where: { seedId: { in: ids } },
      _count: { topic: true },
      orderBy: { _count: { topic: "desc" } },
      take: 8,
    })
    .catch(() => [] as { topic: string; _count: { topic: number } }[]);

  return (grouped as { topic: string }[])
    .map((g) => TOPIC_BY_KEY.get(g.topic))
    .filter((t): t is (typeof EXPLORE_TOPICS)[number] => !!t)
    .map((t) => ({ key: t.key, label: t.label, emoji: t.emoji }));
}

// The topics shown on someone's profile: their own curated list if they've set
// one (via the topic editor / interests), otherwise Claude's auto-inferred
// involvement. Curating gives full add/remove control; clearing it falls back to
// auto again.
export async function getProfileTopics(
  userId: string,
): Promise<{ key: string; label: string; emoji: string }[]> {
  const interests = await db.userInterest
    .findMany({ where: { userId }, select: { topic: true } })
    .catch(() => [] as { topic: string }[]);
  if (interests.length > 0) {
    return interests
      .map((i) => TOPIC_BY_KEY.get(i.topic))
      .filter((t): t is (typeof EXPLORE_TOPICS)[number] => !!t)
      .map((t) => ({ key: t.key, label: t.label, emoji: t.emoji }))
      .slice(0, 12);
  }
  return getInvolvedTopics(userId);
}

// A public profile — what anyone signed in can see about a person: their name,
// photo, a short bio, a few safe activity counts, and the recognition the
// community has given them (labels only, no private garden names). Deliberately
// leaks no private seed/garden titles.
export async function getPublicProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true, bio: true, createdAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.name === "Claude" || user.name === "ChatGPT") return null;

  const [contributions, seedsPlanted, bloomsHelped, recognitions, topics] = await Promise.all([
    db.contribution.count({ where: { authorId: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null, bloomId: { not: null } } }),
    db.userRecognition
      .findMany({ where: { userId }, include: { label: true } })
      .catch(() => [] as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]),
    getProfileTopics(userId).catch(() => [] as { key: string; label: string; emoji: string }[]),
  ]);

  // Aggregate recognitions by label (across gardens) — count, not garden names.
  const byLabel = new Map<string, { emoji: string; label: string; count: number }>();
  for (const r of recognitions as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]) {
    const cur =
      byLabel.get(r.labelKey) ?? { emoji: r.label?.emoji ?? "✦", label: r.label?.label ?? r.labelKey, count: 0 };
    cur.count += 1;
    byLabel.set(r.labelKey, cur);
  }

  return {
    id: user.id,
    name: user.name,
    image: user.image,
    bio: user.bio,
    joinedAt: user.createdAt.toISOString(),
    stats: { contributions, seedsPlanted, bloomsHelped },
    recognitions: [...byLabel.values()].sort((a, b) => b.count - a.count),
    topics,
  };
}
