import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  ensureSeedParticipant,
  requireSeedAccess,
  requireGardenSteward,
} from "@/lib/authz";
import { claudeReply, mediate, mentionsClaude, type ContribForAI } from "@/lib/ai";

async function seedOrThrow(seedId: string) {
  const seed = await db.seed.findUnique({ where: { id: seedId } });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  return seed;
}

const CLAUDE_EMAIL = "claude@rhyza.ai";

// Claude is a permanent participant: one shared system user that authors its
// replies. Created lazily the first time someone tags @claude.
async function getOrCreateClaudeUser() {
  return db.user.upsert({
    where: { email: CLAUDE_EMAIL },
    update: {},
    create: { email: CLAUDE_EMAIL, name: "Claude" },
    select: { id: true, name: true, image: true },
  });
}

// When a contribution tags @claude, generate Claude's reply and post it as a
// contribution authored by the Claude system user (threaded under the mention).
// Returns the new contribution DTO, or null if AI is off / the call failed.
export async function respondAsClaude(
  seedId: string,
  dimension: string,
  mentionText: string,
  parentId: string,
) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    include: {
      contributions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!seed) return null;

  const thread: ContribForAI[] = seed.contributions.map((c) => ({
    dimension: c.dimension,
    author: c.author.name || "A member",
    text: (c.content as { text?: string } | null)?.text ?? "",
  }));

  const reply = await claudeReply({
    title: seed.title,
    content: seed.content,
    dimension,
    mention: mentionText,
    contributions: thread,
  });
  if (!reply) return null;

  const claude = await getOrCreateClaudeUser();
  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: claude.id,
      dimension,
      parentId,
      content: { text: reply },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return contribution;
}

// Ask Claude to mediate the seed's discussion. Posts the mediation as a
// contribution by the Claude system user in the Debate dimension. Requires seed
// access; returns the new contribution, or null if AI is off / failed.
export async function mediateSeed(userId: string, seedId: string) {
  await requireSeedAccess(userId, seedId);
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    include: {
      contributions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!seed) throw new ApiError("NOT_FOUND", "Seed not found");

  const thread: ContribForAI[] = seed.contributions.map((c) => ({
    dimension: c.dimension,
    author: c.author.name || "A member",
    text: (c.content as { text?: string } | null)?.text ?? "",
  }));

  const text = await mediate({
    title: seed.title,
    content: seed.content,
    contributions: thread,
  });
  if (!text) return null;

  const claude = await getOrCreateClaudeUser();
  const contribution = await db.contribution.create({
    data: {
      seedId,
      authorId: claude.id,
      dimension: "debate",
      content: { text: `🕊️ **Mediation**\n\n${text}` },
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return contribution;
}

export async function addContribution(
  userId: string,
  seedId: string,
  input: { dimension: string; text: string; parentId?: string },
) {
  const seed = await seedOrThrow(seedId);
  await ensureSeedParticipant(userId, seedId);

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
  await requireSeedAccess(userId, contribution.seedId);

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

// Edit a contribution's text — author only.
export async function editContribution(userId: string, contributionId: string, text: string) {
  const c = await db.contribution.findUnique({ where: { id: contributionId } });
  if (!c || c.deletedAt) throw new ApiError("NOT_FOUND", "Contribution not found");
  if (c.authorId !== userId) throw new ApiError("FORBIDDEN", "You can only edit your own contributions");
  await db.contribution.update({
    where: { id: contributionId },
    data: { content: { text } },
  });
  return { id: contributionId, text };
}

// Soft-delete a contribution — author or a garden steward.
export async function deleteContribution(userId: string, contributionId: string) {
  const c = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: true },
  });
  if (!c || c.deletedAt) throw new ApiError("NOT_FOUND", "Contribution not found");
  // The author can always delete their own. For a public seed a garden steward
  // can moderate; private seeds aren't visible to garden stewards, so there
  // requireSeedAccess throws unless the steward is actually a seed member.
  if (c.authorId !== userId) {
    await requireSeedAccess(userId, c.seedId);
    if (c.seed.visibility !== "private") {
      await requireGardenSteward(userId, c.seed.gardenId);
    } else {
      throw new ApiError("FORBIDDEN", "Only the author can delete this");
    }
  } else {
    await requireSeedAccess(userId, c.seedId);
  }
  await db.contribution.update({
    where: { id: contributionId },
    data: { deletedAt: new Date() },
  });
  return { id: contributionId, deleted: true };
}

// Toggle an endorsement on a contribution (recognizing the contributor's role,
// distinct from a reaction). Notifies the author the first time.
export async function toggleEndorsement(userId: string, contributionId: string) {
  const contribution = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { seed: true },
  });
  if (!contribution || contribution.deletedAt) {
    throw new ApiError("NOT_FOUND", "Contribution not found");
  }
  await requireSeedAccess(userId, contribution.seedId);

  const existing = await db.contributionEndorsement.findUnique({
    where: { contributionId_endorserId: { contributionId, endorserId: userId } },
  });
  if (existing) {
    await db.contributionEndorsement.delete({
      where: { contributionId_endorserId: { contributionId, endorserId: userId } },
    });
  } else {
    await db.contributionEndorsement.create({
      data: { contributionId, endorserId: userId },
    });
    if (contribution.authorId !== userId) {
      await db.notification.create({
        data: {
          recipientId: contribution.authorId,
          actorId: userId,
          type: "endorsement",
          title: "Your contribution was endorsed ✦",
          entityType: "seed",
          entityId: contribution.seedId,
        },
      });
    }
  }
  const count = await db.contributionEndorsement.count({ where: { contributionId } });
  return { endorsed: !existing, count };
}
