import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureGardenMember, requireGardenAccess } from "@/lib/authz";

async function seedOrThrow(seedId: string) {
  const seed = await db.seed.findUnique({ where: { id: seedId } });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  return seed;
}

export async function addContribution(
  userId: string,
  seedId: string,
  input: { dimension: string; text: string; parentId?: string },
) {
  const seed = await seedOrThrow(seedId);
  await ensureGardenMember(userId, seed.gardenId);

  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: userId,
      dimension: input.dimension,
      parentId: input.parentId ?? null,
      content: { text: input.text },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  // Notify the seed's author (unless they're the contributor).
  if (seed.createdById !== userId) {
    await db.notification.create({
      data: {
        recipientId: seed.createdById,
        actorId: userId,
        type: "contribution",
        title: "New contribution on your seed",
        body: seed.title,
        entityType: "seed",
        entityId: seedId,
      },
    });
  }

  return contribution;
}

// Toggle a reaction on/off for the current user; returns updated counts.
export async function toggleReaction(
  userId: string,
  contributionId: string,
  reactionKey: string,
) {
  const contribution = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: true },
  });
  if (!contribution || contribution.deletedAt) {
    throw new ApiError("NOT_FOUND", "Contribution not found");
  }
  await requireGardenAccess(userId, contribution.seed.gardenId);

  const reactionType = await db.reactionType.findUnique({
    where: { key: reactionKey },
  });
  if (!reactionType || !reactionType.isActive) {
    throw new ApiError("BAD_REQUEST", "Unknown reaction");
  }

  const existing = await db.contributionReaction.findUnique({
    where: {
      contributionId_userId_reactionKey: { contributionId, userId, reactionKey },
    },
  });
  if (existing) {
    await db.contributionReaction.delete({
      where: {
        contributionId_userId_reactionKey: { contributionId, userId, reactionKey },
      },
    });
  } else {
    await db.contributionReaction.create({
      data: { contributionId, userId, reactionKey },
    });
  }

  const rows = await db.contributionReaction.groupBy({
    by: ["reactionKey"],
    where: { contributionId },
    _count: { reactionKey: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.reactionKey] = r._count.reactionKey;
  return { reacted: !existing, counts };
}
