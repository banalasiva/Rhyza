import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Resolve the signed-in user id, or throw 401. Use in API routes.
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError("UNAUTHORIZED", "Sign in required");
  return session.user.id;
}

// Like requireUserId but returns null instead of throwing — for pages.
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// Throw 403 unless the user belongs to the org.
export async function requireOrgMember(userId: string, orgId: string) {
  const m = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!m) throw new ApiError("FORBIDDEN", "Not a member of this organization");
  return m;
}

// Throw 403 unless the user can access the garden.
//   public garden  → any member of the org can access (org-wide visibility)
//   private garden → only garden members (and the creator) can access
export async function requireGardenAccess(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({ where: { id: gardenId } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  await requireOrgMember(userId, garden.orgId);
  if (garden.visibility === "private" && garden.createdById !== userId) {
    const member = await db.gardenMember.findUnique({
      where: { gardenId_userId: { gardenId, userId } },
    });
    if (!member) throw new ApiError("FORBIDDEN", "This garden is private");
  }
  return garden;
}

// Throw 403/404 unless the user can access this seed. Requires garden access
// first (so private gardens are enforced), then for a PRIVATE seed requires
// being its creator or an explicit seed member. Private seeds are invisible to
// everyone else — including garden stewards.
// Load a seed row, tolerating a DB where the new `listed` / `last_activity_at`
// columns haven't been migrated yet (treat listed as false). This keeps core
// seed access working in the window between deploying this code and applying
// the explore migration.
async function loadSeedRow(seedId: string) {
  try {
    return await db.seed.findUnique({ where: { id: seedId } });
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
      },
    });
    return s ? { ...s, listed: false } : null;
  }
}

export async function requireSeedAccess(userId: string, seedId: string) {
  const seed = await loadSeedRow(seedId);
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  // World-public (listed) seeds are readable by ANY signed-in user, across orgs
  // — that's the public square. Org/garden/private checks are skipped for them.
  if (seed.listed && seed.visibility === "public") return seed;
  await requireGardenAccess(userId, seed.gardenId);
  if (seed.visibility === "private" && seed.createdById !== userId) {
    const member = await db.seedMember.findUnique({
      where: { seedId_userId: { seedId, userId } },
    });
    if (!member) throw new ApiError("NOT_FOUND", "Seed not found");
  }
  return seed;
}

// Ensure the user can participate in the seed. For a normal seed this auto-joins
// the garden (org member). For a WORLD-PUBLIC seed, a cross-org joiner is
// contained to a seed membership only — joining one public seed must never grant
// access to the rest of that garden/org.
export async function ensureSeedParticipant(userId: string, seedId: string) {
  const seed = await requireSeedAccess(userId, seedId);
  if (seed.listed && seed.visibility === "public") {
    await db.seedMember.upsert({
      where: { seedId_userId: { seedId, userId } },
      update: {},
      create: { seedId, userId, role: "member" },
    });
    return seed;
  }
  await db.gardenMember.upsert({
    where: { gardenId_userId: { gardenId: seed.gardenId, userId } },
    update: {},
    create: { gardenId: seed.gardenId, userId },
  });
  return seed;
}

// Throw 403 unless the user may manage the seed (force/revert bloom, change
// visibility, invite). The seed's creator always may. For a public seed a
// garden steward may; for a private seed only a seed steward may (garden
// stewards can't even see it).
export async function requireSeedManager(userId: string, seedId: string) {
  const seed = await requireSeedAccess(userId, seedId);
  if (seed.createdById === userId) return seed;
  if (seed.visibility === "private") {
    const m = await db.seedMember.findUnique({
      where: { seedId_userId: { seedId, userId } },
    });
    if (m?.role === "steward") return seed;
    throw new ApiError("FORBIDDEN", "Only the seed owner can do that");
  }
  await requireGardenSteward(userId, seed.gardenId);
  return seed;
}

// Ensure the user is a garden member; auto-join org members on first interaction
// so contributing to an org garden doesn't require a separate join step.
export async function ensureGardenMember(userId: string, gardenId: string) {
  const garden = await requireGardenAccess(userId, gardenId);
  await db.gardenMember.upsert({
    where: { gardenId_userId: { gardenId, userId } },
    update: {},
    create: { gardenId, userId },
  });
  return garden;
}

// Throw 403 unless the user is a steward of the garden (or its creator).
// Stewards can edit/delete the garden and moderate contributions.
export async function requireGardenSteward(userId: string, gardenId: string) {
  const garden = await db.garden.findUnique({ where: { id: gardenId } });
  if (!garden) throw new ApiError("NOT_FOUND", "Garden not found");
  if (garden.createdById === userId) return garden;
  const member = await db.gardenMember.findUnique({
    where: { gardenId_userId: { gardenId, userId } },
  });
  if (member?.role !== "steward") {
    throw new ApiError("FORBIDDEN", "Only a garden steward can do that");
  }
  return garden;
}

// The user's primary org (first joined). v1 assumes one org per user for the
// happy path; the schema supports many.
export async function primaryOrgId(userId: string): Promise<string | null> {
  const m = await db.orgMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  return m?.orgId ?? null;
}
