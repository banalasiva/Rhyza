import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureGardenMember, requireSeedManager } from "@/lib/authz";
import { STAGE_KEYS, type StageKey } from "@/lib/constants";

export async function plantSeed(
  userId: string,
  gardenId: string,
  input: { title: string; content?: string; visibility?: "public" | "private" },
) {
  await ensureGardenMember(userId, gardenId);
  const visibility = input.visibility === "private" ? "private" : "public";
  const seed = await db.seed.create({
    data: {
      gardenId,
      createdById: userId,
      title: input.title,
      content: input.content ?? "",
      visibility,
      // The planter implicitly votes the seed at its first stage.
      stageVotes: { create: { userId, stage: "seed" } },
      // A private seed starts with its creator as the first (steward) member.
      ...(visibility === "private"
        ? { members: { create: { userId, role: "steward" } } }
        : {}),
    },
  });
  return seed;
}

// Soft-delete a seed — creator / seed steward (or garden steward for public
// seeds). Keeps the row (deletedAt) so contributions/blooms aren't orphaned.
export async function deleteSeed(userId: string, seedId: string) {
  const seed = await requireSeedManager(userId, seedId);
  await db.seed.update({
    where: { id: seedId },
    data: { deletedAt: new Date() },
  });
  return { deleted: true, gardenId: seed.gardenId };
}

// Change a seed's visibility — creator / seed steward only.
export async function setSeedVisibility(
  userId: string,
  seedId: string,
  visibility: "public" | "private",
) {
  const seed = await requireSeedManager(userId, seedId);
  if (seed.visibility === visibility) return { id: seedId, visibility };
  await db.$transaction(async (tx) => {
    await tx.seed.update({ where: { id: seedId }, data: { visibility } });
    // Going private: make sure the creator is a member so they keep access.
    if (visibility === "private") {
      await tx.seedMember.upsert({
        where: { seedId_userId: { seedId, userId: seed.createdById } },
        update: {},
        create: { seedId, userId: seed.createdById, role: "steward" },
      });
    }
  });
  return { id: seedId, visibility };
}

// Vote distribution across stages, with percentages.
export async function stageDistribution(seedId: string) {
  const rows = await db.seedStageVote.groupBy({
    by: ["stage"],
    where: { seedId },
    _count: { stage: true },
  });
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    counts[r.stage] = r._count.stage;
    total += r._count.stage;
  }
  return STAGE_KEYS.map((stage) => {
    const votes = counts[stage] ?? 0;
    return {
      stage,
      votes,
      pct: total === 0 ? 0 : Math.round((votes / total) * 100),
    };
  });
}

export type SeedDetail = Awaited<ReturnType<typeof getSeedDetail>>;

export async function getSeedDetail(userId: string, seedId: string) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      garden: {
        select: { id: true, name: true, emoji: true, orgId: true, createdById: true, visibility: true },
      },
    },
  });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");

  // One parallel batch: authorization + all the data, instead of 5 sequential
  // round-trips (this dominates latency when the DB is far away).
  const [orgMember, member, seedMember, distribution, myVote, contributions] = await Promise.all([
    db.orgMember.findUnique({
      where: { orgId_userId: { orgId: seed.garden.orgId, userId } },
    }),
    db.gardenMember.findUnique({
      where: { gardenId_userId: { gardenId: seed.gardenId, userId } },
    }),
    db.seedMember.findUnique({
      where: { seedId_userId: { seedId, userId } },
    }),
    stageDistribution(seedId),
    db.seedStageVote.findUnique({
      where: { seedId_userId: { seedId, userId } },
    }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
        reactions: true,
        endorsements: true,
      },
    }),
  ]);
  if (!orgMember) throw new ApiError("FORBIDDEN", "Not a member of this organization");

  const isCreator = seed.createdById === userId;
  // Private garden: must be a garden member (or creator).
  if (seed.garden.visibility === "private" && !isCreator && !member) {
    throw new ApiError("NOT_FOUND", "Seed not found");
  }
  // Private seed: must be its creator or an explicit seed member.
  if (seed.visibility === "private" && !isCreator && !seedMember) {
    throw new ApiError("NOT_FOUND", "Seed not found");
  }

  const canBloom =
    isCreator ||
    seed.garden.createdById === userId ||
    member?.role === "steward" ||
    seedMember?.role === "steward";
  // Who can change visibility / invite to a private seed: creator or seed steward.
  const canManage = isCreator || seedMember?.role === "steward";

  const contribs = contributions.map((c) => {
    const reactionCounts: Record<string, number> = {};
    const myReactions: string[] = [];
    for (const r of c.reactions) {
      reactionCounts[r.reactionKey] = (reactionCounts[r.reactionKey] ?? 0) + 1;
      if (r.userId === userId) myReactions.push(r.reactionKey);
    }
    const content = c.content as { text?: string } | null;
    return {
      id: c.id,
      dimension: c.dimension,
      parentId: c.parentId,
      text: content?.text ?? "",
      author: c.author,
      createdAt: c.createdAt.toISOString(),
      reactionCounts,
      myReactions,
      endorsementCount: c.endorsements.length,
      iEndorsed: c.endorsements.some((e) => e.endorserId === userId),
    };
  });

  return {
    id: seed.id,
    title: seed.title,
    content: seed.content,
    stage: seed.stage as StageKey,
    visibility: seed.visibility as "public" | "private",
    bloomId: seed.bloomId,
    author: seed.createdBy,
    garden: { id: seed.garden.id, name: seed.garden.name, emoji: seed.garden.emoji },
    canBloom,
    canManage,
    distribution,
    myVote: myVote?.stage ?? null,
    contributions: contribs,
  };
}
