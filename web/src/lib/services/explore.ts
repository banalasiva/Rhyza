import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, requireSeedManager } from "@/lib/authz";
import { inferSeedTopics } from "@/lib/ai";
import { getUserTopics } from "@/lib/services/profile";
import { deliver } from "@/lib/services/notify";

export type ExploreSeed = {
  id: string;
  title: string;
  content: string;
  stage: string;
  topics: string[];
  author: { id: string; name: string; image: string | null };
  garden: { name: string; emoji: string };
  contributionCount: number;
  followerCount: number;
  following: boolean;
  lastActivityAt: string;
};

type SeedRow = {
  id: string;
  title: string;
  content: string;
  stage: string;
  lastActivityAt: Date;
  createdBy: { id: string; name: string | null; image: string | null };
  garden: { name: string; emoji: string };
  topics?: { topic: string }[];
  _count: { contributions: number; followers: number };
};

const baseSelect = {
  id: true,
  title: true,
  content: true,
  stage: true,
  lastActivityAt: true,
  createdBy: { select: { id: true, name: true, image: true } },
  garden: { select: { name: true, emoji: true } },
  _count: { select: { contributions: true, followers: true } },
} as const;

// The public square: world-public seeds across all orgs. Personalised — seeds
// matching the viewer's interests float to the top — and optionally filtered to
// a single topic. Resilient: if the seed_topics table isn't there yet
// (pre-migration), it still lists everything, just without topic data.
export async function listExplore(
  userId: string,
  opts: { topic?: string; take?: number } = {},
): Promise<ExploreSeed[]> {
  const take = opts.take ?? 40;
  const topic = opts.topic?.trim() || undefined;

  const where = {
    listed: true,
    visibility: "public",
    deletedAt: null,
    ...(topic ? { topics: { some: { topic } } } : {}),
  };

  let seeds: SeedRow[];
  try {
    seeds = (await db.seed.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      take: topic ? take : take * 2, // fetch extra so personalisation can reorder
      select: { ...baseSelect, topics: { select: { topic: true } } },
    })) as SeedRow[];
  } catch {
    // seed_topics not migrated yet (or topic filter unusable) — fall back to the
    // plain feed so Explore never goes dark.
    if (topic) return [];
    seeds = (await db.seed.findMany({
      where: { listed: true, visibility: "public", deletedAt: null },
      orderBy: { lastActivityAt: "desc" },
      take,
      select: baseSelect,
    })) as SeedRow[];
  }

  const interests = await getViewerTopicSet(userId);
  const ids = seeds.map((s) => s.id);
  const mine =
    ids.length > 0
      ? await db.seedFollow.findMany({
          where: { userId, seedId: { in: ids } },
          select: { seedId: true },
        })
      : [];
  const followed = new Set(mine.map((f: { seedId: string }) => f.seedId));

  const mapped = seeds.map((s) => {
    const topics = (s.topics ?? []).map((t) => t.topic);
    return {
      id: s.id,
      title: s.title,
      content: s.content,
      stage: s.stage,
      topics,
      author: { id: s.createdBy.id, name: s.createdBy.name || "Someone", image: s.createdBy.image },
      garden: { name: s.garden.name, emoji: s.garden.emoji },
      contributionCount: s._count.contributions,
      followerCount: s._count.followers,
      following: followed.has(s.id),
      lastActivityAt: s.lastActivityAt.toISOString(),
      _match: interests.size > 0 && topics.some((t) => interests.has(t.toLowerCase())) ? 1 : 0,
    };
  });

  // Personalise only the unfiltered feed: interest-matching seeds first, then by
  // recency (already in recency order from the query). A topic-filtered view is
  // left in pure recency order.
  if (!topic && interests.size > 0) {
    mapped.sort((a, b) => b._match - a._match); // stable: ties keep recency order
  }

  return mapped.slice(0, take).map(({ _match, ...rest }) => rest);
}

// ── Personalisation & topic chips ─────────────────────────────────────────

// The viewer's own areas of involvement (Claude-inferred profile topics),
// lowercased, used to float matching public seeds to the top of Explore. No
// fixed taxonomy, no manual interest-picking — it's derived from what they do.
async function getViewerTopicSet(userId: string): Promise<Set<string>> {
  const topics = await getUserTopics(userId).catch(() => [] as string[]);
  return new Set(topics.map((t) => t.toLowerCase()));
}

// The topic chips to show on Explore — the most common free-form topics across
// the seeds actually listed to the world. Purely data-driven; empty (so the
// filter just shows "For you") if nothing's tagged yet.
export async function getExploreTopics(limit = 18): Promise<string[]> {
  try {
    const grouped = await db.seedTopic.groupBy({
      by: ["topic"],
      where: { seed: { listed: true, visibility: "public", deletedAt: null } },
      _count: { topic: true },
      orderBy: { _count: { topic: "desc" } },
      take: limit,
    });
    return (grouped as { topic: string }[]).map((g) => g.topic);
  } catch {
    return []; // seed_topics not migrated yet
  }
}

// ── Listing to the world ──────────────────────────────────────────────────

// Owner/manager publishes a seed to the world (or pulls it back). Only PUBLIC
// seeds can be world-listed. On first listing we tag it (Claude) and notify the
// people whose interests match — that's the personalised discovery hook.
export async function setSeedListed(userId: string, seedId: string, listed: boolean) {
  const seed = await requireSeedManager(userId, seedId);
  if (listed && seed.visibility !== "public") {
    throw new ApiError("BAD_REQUEST", "Make the seed public before listing it to the world.");
  }
  await db.seed.update({
    where: { id: seedId },
    data: { listed, lastActivityAt: new Date() },
  });

  if (listed) {
    // Best-effort tagging + interest fan-out; never block the listing on it.
    try {
      const topics = await ensureSeedTopics(seedId, seed.title, seed.content);
      if (topics.length > 0) await notifyInterested(seedId, seed.title, seed.createdById, topics);
    } catch (err) {
      console.error("[explore] tag/notify on list failed", err);
    }
  }
  return { ok: true, listed };
}

// Tag a seed with topics if it has none yet. Returns the seed's topic keys.
async function ensureSeedTopics(seedId: string, title: string, content: string): Promise<string[]> {
  const existing = await db.seedTopic.findMany({ where: { seedId }, select: { topic: true } });
  if (existing.length > 0) return existing.map((t: { topic: string }) => t.topic);
  const topics = await inferSeedTopics({ title, content });
  if (topics.length > 0) {
    await db.seedTopic.createMany({
      data: topics.map((topic) => ({ seedId, topic })),
      skipDuplicates: true,
    });
  }
  return topics;
}

// One-time-ish backfill: tag seeds that have no topics yet (e.g. private seeds
// created before auto-tagging). Batched so a single call can't time out — the
// admin re-runs it until `remaining` stops dropping.
export async function backfillSeedTopics(limit = 15): Promise<{ tagged: number; remaining: number }> {
  const untagged = await db.seed.findMany({
    where: { deletedAt: null, topics: { none: {} } },
    select: { id: true, title: true, content: true },
    take: limit,
  });
  let tagged = 0;
  for (const s of untagged) {
    try {
      const topics = await inferSeedTopics({ title: s.title, content: s.content ?? "" });
      if (topics.length) {
        await db.seedTopic.createMany({
          data: topics.map((topic) => ({ seedId: s.id, topic })),
          skipDuplicates: true,
        });
        tagged++;
      }
    } catch {
      /* skip this one */
    }
  }
  const remaining = await db.seed.count({ where: { deletedAt: null, topics: { none: {} } } });
  return { tagged, remaining };
}

// Notify everyone (other than the author) whose own areas of involvement overlap
// this fresh public seed's topics — Claude-matched, no fixed taxonomy. Push flows
// through the normal pipeline; the nudge cron will re-surface it if missed.
async function notifyInterested(
  seedId: string,
  seedTitle: string,
  authorId: string,
  topics: string[],
) {
  const interested = await db.userTopic.findMany({
    where: { topic: { in: topics }, userId: { not: authorId } },
    select: { userId: true, topic: true },
    take: 2000,
  });
  if (interested.length === 0) return;

  // One notification per person, labelled by the first topic they matched.
  const firstTopicByUser = new Map<string, string>();
  for (const row of interested as { userId: string; topic: string }[]) {
    if (!firstTopicByUser.has(row.userId)) firstTopicByUser.set(row.userId, row.topic);
  }

  const rows = await Promise.all(
    [...firstTopicByUser].map(([recipientId, topic]) =>
      db.notification
        .create({
          data: {
            recipientId,
            actorId: authorId,
            type: "explore",
            title: `New ${topic} seed 🌱`,
            body: seedTitle,
            entityType: "seed",
            entityId: seedId,
          },
          select: { id: true, recipientId: true },
        })
        .catch(() => null),
    ),
  );

  const created = rows.filter(
    (r: { id: string; recipientId: string } | null): r is { id: string; recipientId: string } =>
      r !== null,
  );
  await deliver(
    created.map((r: { id: string; recipientId: string }) => ({
      notificationId: r.id,
      recipientId: r.recipientId,
      type: "explore",
      push: { title: "A new seed you might care about 🌱", body: seedTitle },
      link: `/seeds/${seedId}`,
    })),
  );
}

// ── Follow / activity / moderation (unchanged) ────────────────────────────

// Follow / unfollow a seed (any seed the viewer can access). Following routes
// the seed's activity to them through the normal notification pipeline.
export async function followSeed(userId: string, seedId: string, following: boolean) {
  await requireSeedAccess(userId, seedId); // listed seeds pass for anyone
  if (following) {
    await db.seedFollow.upsert({
      where: { seedId_userId: { seedId, userId } },
      update: {},
      create: { seedId, userId },
    });
  } else {
    await db.seedFollow.deleteMany({ where: { seedId, userId } });
  }
  return { ok: true, following };
}

// Bump a seed's activity timestamp so it rises on /explore. Best-effort.
export async function bumpSeedActivity(seedId: string) {
  await db.seed.update({ where: { id: seedId }, data: { lastActivityAt: new Date() } }).catch(() => {});
}

// Flag public content for moderation. Anyone who can see the seed can report.
export async function reportSeed(
  userId: string,
  seedId: string,
  reason: string,
  contributionId?: string,
) {
  await requireSeedAccess(userId, seedId);
  const clean = reason.trim().slice(0, 500) || "Reported";
  await db.seedReport.create({
    data: { seedId, contributionId: contributionId ?? null, reporterId: userId, reason: clean },
  });
  return { ok: true };
}
