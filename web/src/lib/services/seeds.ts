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

// Edit a seed's question and/or framing — creator / seed steward only.
export async function updateSeed(
  userId: string,
  seedId: string,
  data: { title?: string; content?: string },
) {
  await requireSeedManager(userId, seedId);
  const patch: { title?: string; content?: string } = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.content !== undefined) patch.content = data.content;
  if (Object.keys(patch).length === 0) return { id: seedId };
  await db.seed.update({ where: { id: seedId }, data: patch });
  return { id: seedId, ...patch };
}

// How many distinct people are participating in a seed: everyone who has
// authored a (non-deleted) contribution, plus the seed's planter. Used to size
// the bloom target. Matches the "participants" count shown in the UI.
export async function countParticipants(seedId: string): Promise<number> {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    select: { createdById: true },
  });
  const authors = await db.contribution.findMany({
    where: { seedId, deletedAt: null },
    select: { authorId: true },
    distinct: ["authorId"],
  });
  const ids = new Set(authors.map((a) => a.authorId));
  if (seed) ids.add(seed.createdById);
  return Math.max(1, ids.size);
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

// Load the seed + its relations, tolerating a DB where the new `listed` column
// isn't migrated yet (so the seed page never 500s in the deploy→migrate window).
async function loadSeedForDetail(seedId: string) {
  const include = {
    createdBy: { select: { id: true, name: true, image: true } },
    garden: {
      select: { id: true, name: true, emoji: true, orgId: true, createdById: true, visibility: true },
    },
  } as const;
  try {
    return await db.seed.findUnique({ where: { id: seedId }, include });
  } catch {
    const s = await db.seed.findUnique({
      where: { id: seedId },
      select: {
        id: true,
        gardenId: true,
        createdById: true,
        title: true,
        content: true,
        stage: true,
        visibility: true,
        bloomId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdBy: { select: { id: true, name: true, image: true } },
        garden: {
          select: { id: true, name: true, emoji: true, orgId: true, createdById: true, visibility: true },
        },
      },
    });
    return s ? { ...s, listed: false } : null;
  }
}

export async function getSeedDetail(userId: string, seedId: string) {
  const seed = await loadSeedForDetail(seedId);
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");

  // The pool of people who can be @-tagged: members who can actually see this
  // seed (garden members for a public seed; seed members for a private one).
  // For a private OR world-public seed the taggable pool is the explicit seed
  // members (+ contributors, added below) — never the whole garden roster, so a
  // stranger viewing a listed seed can't enumerate the garden's members.
  const peoplePromise =
    seed.visibility === "private" || seed.listed
      ? db.seedMember.findMany({
          where: { seedId },
          include: { user: { select: { id: true, name: true, image: true } } },
        })
      : db.gardenMember.findMany({
          where: { gardenId: seed.gardenId },
          include: { user: { select: { id: true, name: true, image: true } } },
        });

  // One parallel batch: authorization + all the data, instead of 5 sequential
  // round-trips (this dominates latency when the DB is far away).
  const [orgMember, member, seedMember, distribution, myVote, contributions, peopleRows, follow] =
    await Promise.all([
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
      peoplePromise,
      // Resilient: the seed_follows table may not be migrated yet.
      db.seedFollow.findUnique({ where: { seedId_userId: { seedId, userId } } }).catch(() => null),
    ]);
  // World-public seeds are viewable across orgs; everyone else must be an org member.
  if (!orgMember && !(seed.listed && seed.visibility === "public")) {
    throw new ApiError("FORBIDDEN", "Not a member of this organization");
  }

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

  // Taggable people = seed-visible members + anyone who's contributed, minus
  // the viewer and the Claude system user (tagged via @claude, not the picker).
  const peopleMap = new Map<string, { id: string; name: string; image: string | null }>();
  for (const r of peopleRows) {
    const u = r.user;
    if (u.id === userId || u.name === "Claude") continue;
    peopleMap.set(u.id, { id: u.id, name: u.name, image: u.image });
  }
  for (const c of contributions) {
    const a = c.author;
    if (!a || a.id === userId || a.name === "Claude" || peopleMap.has(a.id)) continue;
    peopleMap.set(a.id, { id: a.id, name: a.name, image: a.image });
  }
  const people = [...peopleMap.values()];

  const contribs = contributions.map((c) => {
    const reactionCounts: Record<string, number> = {};
    const myReactions: string[] = [];
    for (const r of c.reactions) {
      reactionCounts[r.reactionKey] = (reactionCounts[r.reactionKey] ?? 0) + 1;
      if (r.userId === userId) myReactions.push(r.reactionKey);
    }
    const content = c.content as
      | { text?: string; attachments?: { url: string; type: "image" | "video" | "file"; name?: string }[] }
      | null;
    return {
      id: c.id,
      dimension: c.dimension,
      parentId: c.parentId,
      text: content?.text ?? "",
      attachments: content?.attachments ?? [],
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
    // Defensive: a "bloomed" stage with no actual bloom is a phantom state —
    // present it as active so the UI doesn't show a bloom that doesn't exist.
    stage: (seed.stage === "bloomed" && !seed.bloomId ? "growing" : seed.stage) as StageKey,
    visibility: seed.visibility as "public" | "private",
    listed: seed.listed,
    following: !!follow,
    bloomId: seed.bloomId,
    author: seed.createdBy,
    garden: { id: seed.garden.id, name: seed.garden.name, emoji: seed.garden.emoji },
    canBloom,
    canManage,
    people,
    distribution,
    myVote: myVote?.stage ?? null,
    contributions: contribs,
  };
}
