import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, requireSeedManager } from "@/lib/authz";
import { synthesizeBloom, type ContribForAI } from "@/lib/ai";

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
  await requireSeedAccess(userId, seed.id);

  // Already bloomed → return the existing bloom (idempotent), so a concurrent
  // tipping vote celebrates instead of erroring.
  if (seed.stage === "bloomed" && seed.bloomId) {
    const existing = await db.bloom.findUnique({ where: { id: seed.bloomId } });
    if (existing) return existing;
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

  // AI-synthesize the bloom from the whole thread; fall back to the
  // deterministic summary if Claude isn't configured or the call fails.
  const threadForAI: ContribForAI[] = seed.contributions.map((c) => ({
    dimension: c.dimension,
    author: c.author.name || "A member",
    text: (c.content as { text?: string } | null)?.text ?? "",
  }));
  const aiSummary = await synthesizeBloom({
    title: seed.title,
    content: seed.content,
    contributions: threadForAI,
  });
  const aiSynthesized = aiSummary !== null;
  const summary =
    aiSummary ??
    synthesizeSummary(seed.content, bloomDimensionText, seed.contributions.length);

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
        aiSynthesized,
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
  const seed = await requireSeedManager(userId, seedId);
  if (seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  const bloom = await createBloom(userId, seedId, userId);
  await db.seedStageVote.upsert({
    where: { seedId_userId: { seedId, userId } },
    update: { stage: "bloomed" },
    create: { seedId, userId, stage: "bloomed" },
  });
  return bloom;
}

// Edit a bloom's title/summary. Blooms are collaborative knowledge, so any
// member with access to the garden can refine the synthesized text.
export async function updateBloom(
  userId: string,
  bloomId: string,
  input: { title?: string; summary?: string },
) {
  const bloom = await db.bloom.findUnique({ where: { id: bloomId } });
  if (!bloom) throw new ApiError("NOT_FOUND", "Bloom not found");
  await requireSeedAccess(userId, bloom.seedId);

  const summary = input.summary?.trim();
  const title = input.title?.trim();
  const updated = await db.bloom.update({
    where: { id: bloomId },
    data: {
      ...(title ? { title } : {}),
      ...(summary
        ? {
            summary,
            content: { blocks: [{ type: "paragraph", text: summary }] },
            // A human edited it — it's no longer purely AI-synthesized.
            aiSynthesized: false,
          }
        : {}),
    },
  });
  return { id: updated.id, title: updated.title, summary: updated.summary };
}

// Revert a bloom: delete it, re-open the seed, and pull "bloomed" votes back so
// it doesn't immediately re-bloom. Allowed for the seed's author or a garden
// steward — the same people who can force a bloom. Returns where to send the
// user (back to the now-reopened seed).
export async function revertBloom(userId: string, seedId: string) {
  const seed = await db.seed.findUnique({ where: { id: seedId } });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  if (seed.stage !== "bloomed" || !seed.bloomId) {
    throw new ApiError("CONFLICT", "This seed hasn't bloomed");
  }
  await requireSeedManager(userId, seedId);

  // Re-open at the stage just before bloom so the plant/vote bars make sense.
  const REVERT_TO = "growing";
  const bloomId = seed.bloomId;
  await db.$transaction(async (tx) => {
    await tx.bloom.delete({ where: { id: bloomId } }); // contributors cascade
    await tx.seed.update({
      where: { id: seedId },
      data: { stage: REVERT_TO, bloomId: null },
    });
    await tx.seedStageVote.updateMany({
      where: { seedId, stage: "bloomed" },
      data: { stage: REVERT_TO },
    });
  });

  return { reverted: true, seedId, gardenId: seed.gardenId, stage: REVERT_TO };
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
  // Seed-level access (enforces private gardens AND private seeds).
  const seedRow = await requireSeedAccess(userId, bloom.seedId);

  const [versions, garden, gardenMember, seedMember] = await Promise.all([
    db.bloom.findMany({
      where: { seedId: bloom.seedId },
      select: { id: true, version: true, bloomedAt: true },
      orderBy: { version: "desc" },
    }),
    db.garden.findUnique({
      where: { id: bloom.gardenId },
      select: { createdById: true },
    }),
    db.gardenMember.findUnique({
      where: { gardenId_userId: { gardenId: bloom.gardenId, userId } },
    }),
    db.seedMember.findUnique({
      where: { seedId_userId: { seedId: bloom.seedId, userId } },
    }),
  ]);

  // Reverting needs seed-manager rights, and only while this bloom is still the
  // seed's current (latest) bloom. For a private seed, garden stewards don't
  // count — only the creator or a seed steward.
  const isCurrent = seedRow.stage === "bloomed" && seedRow.bloomId === bloom.id;
  const isManager =
    seedRow.createdById === userId ||
    (seedRow.visibility === "private"
      ? seedMember?.role === "steward"
      : garden?.createdById === userId || gardenMember?.role === "steward");
  const canRevert = isCurrent && isManager;

  return {
    id: bloom.id,
    title: bloom.title,
    summary: bloom.summary,
    aiSynthesized: bloom.aiSynthesized,
    version: bloom.version,
    bloomedAt: bloom.bloomedAt.toISOString(),
    canRevert,
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
