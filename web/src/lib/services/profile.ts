import { db } from "@/lib/db";

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

  const [contributions, seedsPlanted, bloomsHelped, recognitions] = await Promise.all([
    db.contribution.count({ where: { authorId: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null } }),
    db.seed.count({ where: { createdById: userId, deletedAt: null, bloomId: { not: null } } }),
    db.userRecognition
      .findMany({ where: { userId }, include: { label: true } })
      .catch(() => [] as { labelKey: string; label: { emoji: string | null; label: string | null } | null }[]),
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
  };
}
