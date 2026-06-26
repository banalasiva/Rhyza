import { db } from "@/lib/db";
import { requireGardenAccess, requireOrgMember, requireGardenSteward } from "@/lib/authz";
import { uniqueSlug } from "@/lib/slug";

// Edit a garden's metadata — steward/creator only.
export async function updateGarden(
  userId: string,
  gardenId: string,
  input: { name?: string; description?: string; emoji?: string },
) {
  await requireGardenSteward(userId, gardenId);
  return db.garden.update({
    where: { id: gardenId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
    },
  });
}

// Delete a garden and everything in it — steward/creator only.
export async function deleteGarden(userId: string, gardenId: string) {
  await requireGardenSteward(userId, gardenId);
  await db.garden.delete({ where: { id: gardenId } });
  return { deleted: true };
}

// All gardens in the user's org, with seed/member/bloom counts for the list view.
export async function listGardens(userId: string, orgId: string) {
  await requireOrgMember(userId, orgId);
  const gardens = await db.garden.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, seeds: true, blooms: true } },
    },
  });
  return gardens.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    emoji: g.emoji,
    stage: g.stage,
    seedCount: g._count.seeds,
    memberCount: g._count.members,
    bloomCount: g._count.blooms,
  }));
}

export async function createGarden(
  userId: string,
  orgId: string,
  input: { name: string; description?: string; emoji?: string },
) {
  await requireOrgMember(userId, orgId);
  return db.garden.create({
    data: {
      orgId,
      name: input.name,
      slug: uniqueSlug(input.name),
      description: input.description,
      emoji: input.emoji || "🌱",
      createdById: userId,
      members: { create: { userId, role: "steward" } },
    },
  });
}

// Garden detail + its open seeds (not yet bloomed) and recent members.
export async function getGardenDetail(userId: string, gardenId: string) {
  const garden = await requireGardenAccess(userId, gardenId);
  const member = await db.gardenMember.findUnique({
    where: { gardenId_userId: { gardenId, userId } },
  });
  const canManage = garden.createdById === userId || member?.role === "steward";
  const seeds = await db.seed.findMany({
    where: { gardenId, deletedAt: null, stage: { not: "bloomed" } },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { contributions: true } },
    },
  });
  return {
    garden: {
      id: garden.id,
      name: garden.name,
      description: garden.description,
      emoji: garden.emoji,
      stage: garden.stage,
      canManage,
    },
    seeds: seeds.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      stage: s.stage,
      author: s.createdBy,
      contributionCount: s._count.contributions,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

// The Sacred Tree: every bloom in the garden, latest version first.
export async function getSacredTree(userId: string, gardenId: string) {
  await requireGardenAccess(userId, gardenId);
  const blooms = await db.bloom.findMany({
    where: { gardenId },
    orderBy: { bloomedAt: "desc" },
    include: {
      contributors: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Keep only the latest version per seed.
  const latestBySeed = new Map<string, (typeof blooms)[number]>();
  for (const b of blooms) {
    const prev = latestBySeed.get(b.seedId);
    if (!prev || b.version > prev.version) latestBySeed.set(b.seedId, b);
  }
  return [...latestBySeed.values()].map((b) => ({
    id: b.id,
    title: b.title,
    summary: b.summary,
    version: b.version,
    bloomedAt: b.bloomedAt.toISOString(),
    contributors: b.contributors.map((c) => ({
      name: c.name,
      role: c.role,
    })),
  }));
}
