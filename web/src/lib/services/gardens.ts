import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireGardenAccess, requireOrgMember, requireGardenSteward, canManageGarden } from "@/lib/authz";
import { uniqueSlug } from "@/lib/slug";
import { assertNotGuest } from "@/lib/guest";

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
  // The garden's owner/steward or the app owner can delete it.
  if (!(await canManageGarden(userId, gardenId))) {
    throw new ApiError("FORBIDDEN", "You can't delete this garden");
  }
  const garden = await db.garden.findUnique({ where: { id: gardenId }, select: { id: true } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  await db.garden.delete({ where: { id: gardenId } });
  return { deleted: true };
}

// Gardens the viewer can see in their org: public gardens, plus private gardens
// they created or belong to. With seed/member/bloom counts for the list view.
// Which gardens a person should see in their nav / home. The fix for "my mother
// made a garden and added me but it isn't showing": every Gmail user gets their
// own personal org, so a garden someone creates and adds you to lives in THEIR
// org, not your primary one. Gating the whole list on your primary org hid it.
// So: show every garden you CREATED or are a MEMBER of, whatever org it's in —
// plus public gardens within your own org (scoped, so joining one family's space
// doesn't flood your list with every other public garden across bridged orgs).
function gardensVisibleTo(userId: string, orgId: string) {
  return {
    OR: [
      { createdById: userId },
      { members: { some: { userId } } },
      { orgId, visibility: "public" },
    ],
  };
}

export async function listGardens(userId: string, orgId: string) {
  // Run the membership check in parallel with the listing instead of serially
  // before it — one fewer round-trip on the critical path (this is the home
  // page's first paint). If the user isn't a member we throw and the fetched
  // rows are simply discarded.
  const [, gardens] = await Promise.all([
    requireOrgMember(userId, orgId),
    db.garden.findMany({
      where: gardensVisibleTo(userId, orgId),
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true, seeds: true, blooms: true } },
      },
    }),
  ]);
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
  await assertNotGuest(userId, "create a garden");
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

// Lightweight garden header (just id/name/emoji) + the same access check — for
// pages that only need the garden's identity (e.g. the Sacred Tree), so they
// don't pull the full active + bloomed seed lists getGardenDetail fetches.
export async function getGardenHeader(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({
    where: { id: gardenId },
    select: { id: true, name: true, emoji: true, orgId: true, visibility: true, createdById: true },
  });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  const [orgMember, member] = await Promise.all([
    db.orgMember.findUnique({ where: { orgId_userId: { orgId: garden.orgId, userId } } }),
    db.gardenMember.findUnique({ where: { gardenId_userId: { gardenId, userId } } }),
  ]);
  if (garden.visibility !== "public" && !orgMember) {
    throw new ApiError("FORBIDDEN", "Not a member of this organization");
  }
  if (garden.visibility === "private" && garden.createdById !== userId && !member) {
    throw new ApiError("NOT_FOUND", "Garden not found");
  }
  return { garden: { id: garden.id, name: garden.name, emoji: garden.emoji } };
}

// Garden detail + its open seeds (not yet bloomed) and recent members.
export async function getGardenDetail(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({ where: { id: gardenId } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");

  // Authorization + data in one parallel batch. Seeds are pre-filtered to the
  // ones this viewer may see (private seeds they don't belong to are excluded).
  const [orgMember, member, seeds, bloomed] = await Promise.all([
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
        // Active = anything not *truly* bloomed (a "bloomed" stage with no bloom
        // is a phantom and counts as active).
        NOT: { stage: "bloomed", bloomId: { not: null } },
        ...visibleSeedFilter(userId),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        _count: { select: { contributions: true } },
      },
    }),
    // Truly bloomed seeds (have a bloom) — discoverable on the garden page, not
    // just in the Sacred Tree.
    db.seed.findMany({
      where: {
        gardenId,
        deletedAt: null,
        stage: "bloomed",
        bloomId: { not: null },
        ...visibleSeedFilter(userId),
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, bloomId: true, visibility: true },
    }),
  ]);
  // A PUBLIC garden is world-visible — any signed-in viewer can open it (and,
  // via visibleSeedFilter above, sees only its PUBLIC seeds). A private/org
  // garden still requires org membership, and a private garden requires being
  // its creator or a member.
  if (garden.visibility !== "public" && !orgMember) {
    throw new ApiError("FORBIDDEN", "Not a member of this organization");
  }
  if (garden.visibility === "private" && garden.createdById !== userId && !member) {
    throw new ApiError("NOT_FOUND", "Garden not found");
  }
  const canManage = garden.createdById === userId || member?.role === "steward";
  // Does the viewer BELONG to this garden (creator, garden member, or a member
  // of its org)? A world visitor browsing a public garden does not — they can
  // read and jump into public discussions, but not plant seeds here or invite
  // people. Everyone who belongs sees those actions.
  const viewerBelongs = garden.createdById === userId || !!member || !!orgMember;
  return {
    garden: {
      id: garden.id,
      name: garden.name,
      description: garden.description,
      emoji: garden.emoji,
      stage: garden.stage,
      visibility: garden.visibility as "public" | "private",
      canManage,
      viewerBelongs,
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
    bloomed: bloomed.map((s) => ({
      id: s.id,
      title: s.title,
      bloomId: s.bloomId,
      visibility: s.visibility as "public" | "private",
    })),
  };
}

// Navigation tree: the viewer's gardens, each with the seeds they can see,
// sorted alphabetically, for the side panel.
export async function getNavTree(userId: string, orgId: string) {
  await requireOrgMember(userId, orgId);
  const gardens = await db.garden.findMany({
    where: gardensVisibleTo(userId, orgId),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      emoji: true,
      visibility: true,
      seeds: {
        where: { deletedAt: null, ...visibleSeedFilter(userId) },
        orderBy: { title: "asc" },
        select: { id: true, title: true, visibility: true, stage: true, bloomId: true },
      },
    },
  });
  return gardens.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    visibility: g.visibility as "public" | "private",
    seeds: g.seeds.map((s) => ({
      id: s.id,
      title: s.title,
      visibility: s.visibility as "public" | "private",
      bloomed: s.stage === "bloomed" && !!s.bloomId,
    })),
  }));
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
