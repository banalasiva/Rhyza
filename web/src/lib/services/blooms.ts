import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireGardenAccess, requireGardenSteward } from "@/lib/authz";

const DIMENSION_ROLE: Record<string, { type: string; role: string }> = {
  foundations: { type: "explainer", role: "Laid the foundations" },
  understanding: { type: "explainer", role: "Built understanding" },
  application: { type: "practitioner", role: "Grounded it in practice" },
  debate: { type: "debater", role: "Pressure-tested the idea" },
  bloom: { type: "community", role: "Helped it bloom" },
};

// Build a non-AI v1 summary. AI synthesis (docs/ARCHITECTURE.md) is phase 2;
// until then the bloom summary is assembled deterministically from the thread —
// never hardcoded demo text.
function synthesizeSummary(
  seedContent: string,
  bloomDimensionText: string[],
  contributionCount: number,
): string {
  if (bloomDimensionText.length > 0) {
    return bloomDimensionText.join("\n\n");
  }
  if (seedContent.trim()) {
    return seedContent.trim();
  }
  return `This seed bloomed after ${contributionCount} contribution${
    contributionCount === 1 ? "" : "s"
  } across the community. Add a Bloom-dimension note to refine this summary.`;
}

// Create the bloom for a seed (its next version) and mark the seed bloomed.
// Idempotent-ish: refuses if the seed already has a bloom at its latest version.
export async function createBloom(
  userId: string,
  seedId: string,
  triggeredById: string,
) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    include: {
      contributions: {
        where: { deletedAt: null },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  await requireGardenAccess(userId, seed.gardenId);

  if (seed.stage === "bloomed" && seed.bloomId) {
    throw new ApiError("CONFLICT", "This seed has already bloomed");
  }

  const lastVersion = await db.bloom.aggregate({
    where: { seedId },
    _max: { version: true },
  });
  const version = (lastVersion._max.version ?? 0) + 1;

  // Distinct contributors and the dimension they contributed most in.
  const byAuthor = new Map<
    string,
    { name: string; email: string; dims: Record<string, number> }
  >();
  // Seed planter is always a contributor.
  const planter = await db.user.findUnique({
    where: { id: seed.createdById },
    select: { id: true, name: true, email: true },
  });
  if (planter) {
    byAuthor.set(planter.id, { name: planter.name, email: planter.email, dims: {} });
  }
  const bloomDimensionText: string[] = [];
  for (const c of seed.contributions) {
    const entry =
      byAuthor.get(c.authorId) ??
      { name: c.author.name, email: c.author.email, dims: {} };
    entry.dims[c.dimension] = (entry.dims[c.dimension] ?? 0) + 1;
    byAuthor.set(c.authorId, entry);
    if (c.dimension === "bloom") {
      const t = (c.content as { text?: string } | null)?.text;
      if (t) bloomDimensionText.push(t);
    }
  }

  const contributorsData = [...byAuthor.entries()].map(([uid, info], idx) => {
    const dominantDim =
      Object.entries(info.dims).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "bloom";
    const mapped =
      uid === seed.createdById
        ? { type: "seed_planter", role: "Planted the seed" }
        : DIMENSION_ROLE[dominantDim] ?? DIMENSION_ROLE.bloom;
    return {
      userId: uid,
      name: info.name,
      email: info.email,
      role: mapped.role,
      contributionType: mapped.type,
      sortOrder: idx,
      addedById: triggeredById,
    };
  });

  const summary = synthesizeSummary(
    seed.content,
    bloomDimensionText,
    seed.contributions.length,
  );

  // Create the bloom, mark the seed, and record contributors atomically.
  const bloom = await db.$transaction(async (tx) => {
    const created = await tx.bloom.create({
      data: {
        gardenId: seed.gardenId,
        seedId: seed.id,
        version,
        title: seed.title,
        summary,
        content: { blocks: [{ type: "paragraph", text: summary }] },
        aiSynthesized: false,
        createdById: triggeredById,
        contributors: { create: contributorsData },
      },
    });
    await tx.seed.update({
      where: { id: seed.id },
      data: { stage: "bloomed", bloomId: created.id },
    });
    // Notify every contributor that the seed bloomed.
    await tx.notification.createMany({
      data: [...byAuthor.keys()].map((uid) => ({
        recipientId: uid,
        actorId: triggeredById,
        type: "bloom",
        title: "A seed you contributed to has bloomed 🌸",
        body: seed.title,
        entityType: "bloom",
        entityId: created.id,
      })),
    });
    return created;
  });

  return bloom;
}

// Manually bloom a seed now — the seed's author or a garden steward. Bypasses
// the vote threshold (useful for testing and for stewards curating knowledge).
export async function forceBloom(userId: string, seedId: string) {
  const seed = await db.seed.findUnique({ where: { id: seedId } });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  if (seed.createdById !== userId) {
    await requireGardenSteward(userId, seed.gardenId);
  } else {
    await requireGardenAccess(userId, seed.gardenId);
  }
  const bloom = await createBloom(userId, seedId, userId);
  await db.seedStageVote.upsert({
    where: { seedId_userId: { seedId, userId } },
    update: { stage: "bloomed" },
    create: { seedId, userId, stage: "bloomed" },
  });
  return bloom;
}

export async function getBloomDetail(userId: string, bloomId: string) {
  const bloom = await db.bloom.findUnique({
    where: { id: bloomId },
    include: {
      contributors: { orderBy: { sortOrder: "asc" } },
      seed: { select: { id: true, title: true } },
      garden: { select: { id: true, name: true, emoji: true } },
    },
  });
  if (!bloom) throw new ApiError("NOT_FOUND", "Bloom not found");
  await requireGardenAccess(userId, bloom.gardenId);

  const versions = await db.bloom.findMany({
    where: { seedId: bloom.seedId },
    select: { id: true, version: true, bloomedAt: true },
    orderBy: { version: "desc" },
  });

  return {
    id: bloom.id,
    title: bloom.title,
    summary: bloom.summary,
    version: bloom.version,
    bloomedAt: bloom.bloomedAt.toISOString(),
    garden: bloom.garden,
    seed: bloom.seed,
    contributors: bloom.contributors.map((c) => ({
      name: c.name,
      role: c.role,
      contributionType: c.contributionType,
    })),
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      bloomedAt: v.bloomedAt.toISOString(),
    })),
  };
}
