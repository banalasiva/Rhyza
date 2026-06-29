import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, requireSeedManager } from "@/lib/authz";

export type ExploreSeed = {
  id: string;
  title: string;
  content: string;
  stage: string;
  author: { id: string; name: string; image: string | null };
  garden: { name: string; emoji: string };
  contributionCount: number;
  followerCount: number;
  following: boolean;
  lastActivityAt: string;
};

// The public square: world-public seeds across all orgs, hottest first.
export async function listExplore(userId: string, take = 40): Promise<ExploreSeed[]> {
  const seeds = await db.seed.findMany({
    where: { listed: true, visibility: "public", deletedAt: null },
    orderBy: { lastActivityAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      content: true,
      stage: true,
      lastActivityAt: true,
      createdBy: { select: { id: true, name: true, image: true } },
      garden: { select: { name: true, emoji: true } },
      _count: { select: { contributions: true, followers: true } },
    },
  });
  const ids = seeds.map((s: { id: string }) => s.id);
  const mine =
    ids.length > 0
      ? await db.seedFollow.findMany({
          where: { userId, seedId: { in: ids } },
          select: { seedId: true },
        })
      : [];
  const followed = new Set(mine.map((f: { seedId: string }) => f.seedId));

  return seeds.map(
    (s: {
      id: string;
      title: string;
      content: string;
      stage: string;
      lastActivityAt: Date;
      createdBy: { id: string; name: string | null; image: string | null };
      garden: { name: string; emoji: string };
      _count: { contributions: number; followers: number };
    }) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      stage: s.stage,
      author: { id: s.createdBy.id, name: s.createdBy.name || "Someone", image: s.createdBy.image },
      garden: { name: s.garden.name, emoji: s.garden.emoji },
      contributionCount: s._count.contributions,
      followerCount: s._count.followers,
      following: followed.has(s.id),
      lastActivityAt: s.lastActivityAt.toISOString(),
    }),
  );
}

// Owner/manager publishes a seed to the world (or pulls it back). Only PUBLIC
// seeds can be world-listed — a private seed must be made public first.
export async function setSeedListed(userId: string, seedId: string, listed: boolean) {
  const seed = await requireSeedManager(userId, seedId);
  if (listed && seed.visibility !== "public") {
    throw new ApiError("BAD_REQUEST", "Make the seed public before listing it to the world.");
  }
  await db.seed.update({
    where: { id: seedId },
    data: { listed, lastActivityAt: new Date() },
  });
  return { ok: true, listed };
}

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
