import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureGardenMember, requireGardenAccess } from "@/lib/authz";
import { STAGE_KEYS, type StageKey } from "@/lib/constants";

export async function plantSeed(
  userId: string,
  gardenId: string,
  input: { title: string; content?: string },
) {
  await ensureGardenMember(userId, gardenId);
  const seed = await db.seed.create({
    data: {
      gardenId,
      createdById: userId,
      title: input.title,
      content: input.content ?? "",
      // The planter implicitly votes the seed at its first stage.
      stageVotes: { create: { userId, stage: "seed" } },
    },
  });
  return seed;
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
      garden: { select: { id: true, name: true, emoji: true, orgId: true, createdById: true } },
    },
  });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");

  // One parallel batch: authorization + all the data, instead of 5 sequential
  // round-trips (this dominates latency when the DB is far away).
  const [orgMember, member, distribution, myVote, contributions] = await Promise.all([
    db.orgMember.findUnique({
      where: { orgId_userId: { orgId: seed.garden.orgId, userId } },
    }),
    db.gardenMember.findUnique({
      where: { gardenId_userId: { gardenId: seed.gardenId, userId } },
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
  const canBloom =
    seed.createdById === userId ||
    seed.garden.createdById === userId ||
    member?.role === "steward";

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
    bloomId: seed.bloomId,
    author: seed.createdBy,
    garden: { id: seed.garden.id, name: seed.garden.name, emoji: seed.garden.emoji },
    canBloom,
    distribution,
    myVote: myVote?.stage ?? null,
    contributions: contribs,
  };
}
