import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireGardenAccess, requireOrgMember, requireGardenSteward } from "@/lib/authz";
import { uniqueSlug } from "@/lib/slug";

// Which seeds a viewer may see: public seeds, their own, or private seeds they
// belong to. Used to filter garden listings and the Sacred Tree.
function visibleSeedFilter(userId: string) {
  return {
    OR: [
      { visibility: "public" },
      { createdById: userId },
      { members: { some: { userId } } },
    ],
  };
}

// Edit a garden's metadata — steward/creator only.
export async function updateGarden(
  userId: string,
  gardenId: string,
  input: {
    name?: string;
    description?: string;
    emoji?: string;
    visibility?: "public" | "private";
  },
) {
  await requireGardenSteward(userId, gardenId);
  return db.garden.update({
    where: { id: gardenId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    },
  });
}

// Delete a garden and everything in it — steward/creator only.
export async function deleteGarden(userId: string, gardenId: string) {
  await requireGardenSteward(userId, gardenId);
  await db.garden.delete({ where: { id: gardenId } });
  return { deleted: true };
}

// Gardens the viewer can see in their org: public gardens, plus private gardens
// they created or belong to. With seed/member/bloom counts for the list view.
export async function listGardens(userId: string, orgId: string) {
  await requireOrgMember(userId, orgId);
  const gardens = await db.garden.findMany({
    where: {
      orgId,
      OR: [
        { visibility: "public" },
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
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
    visibility: g.visibility as "public" | "private",
    seedCount: g._count.seeds,
    memberCount: g._count.members,
    bloomCount: g._count.blooms,
  }));
}

export async function createGarden(
  userId: string,
  orgId: string,
  input: {
    name: string;
    description?: string;
    emoji?: string;
    visibility?: "public" | "private";
  },
) {
  await requireOrgMember(userId, orgId);
  return db.garden.create({
    data: {
      orgId,
      name: input.name,
      slug: uniqueSlug(input.name),
      description: input.description,
      emoji: input.emoji || "🌱",
      visibility: input.visibility === "private" ? "private" : "public",
      createdById: userId,
      members: { create: { userId, role: "steward" } },
    },
  });
}

// Garden detail + its open seeds (not yet bloomed) and recent members.
export async function getGardenDetail(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({ where: { id: gardenId } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");

  // Authorization + data in one parallel batch. Seeds are pre-filtered to the
  // ones this viewer may see (private seeds they don't belong to are excluded).
  const [orgMember, member, seeds] = await Promise.all([
    db.orgMember.findUnique({
      where: { orgId_userId: { orgId: garden.orgId, userId } },
    }),
    db.gardenMember.findUnique({
      where: { gardenId_userId: { gardenId, userId } },
    }),
    db.seed.findMany({
      where: {
        gardenId,
        deletedAt: null,
        stage: { not: "bloomed" },
        ...visibleSeedFilter(userId),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        _count: { select: { contributions: true } },
      },
    }),
  ]);
  if (!orgMember) throw new ApiError("FORBIDDEN", "Not a member of this organization");
  // Private garden: only its creator or members may see it at all.
  if (garden.visibility === "private" && garden.createdById !== userId && !member) {
    throw new ApiError("NOT_FOUND", "Garden not found");
  }
  const canManage = garden.createdById === userId || member?.role === "steward";
  return {
    garden: {
      id: garden.id,
      name: garden.name,
      description: garden.description,
      emoji: garden.emoji,
      stage: garden.stage,
      visibility: garden.visibility as "public" | "private",
      canManage,
    },
    seeds: seeds.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      stage: s.stage,
      visibility: s.visibility as "public" | "private",
      author: s.createdBy,
      contributionCount: s._count.contributions,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

// The Sacred Tree: every bloom in the garden, latest version first.
export async function getSacredTree(userId: string, gardenId: string) {
  await requireGardenAccess(userId, gardenId);
  // Exclude blooms from private seeds the viewer isn't part of.
  const blooms = await db.bloom.findMany({
    where: { gardenId, seed: visibleSeedFilter(userId) },
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
