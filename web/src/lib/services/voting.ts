import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureSeedParticipant } from "@/lib/authz";
import { bloomTargetFor, STAGE_KEYS } from "@/lib/constants";
import { countParticipants, stageDistribution } from "@/lib/services/seeds";
import { createBloom } from "@/lib/services/blooms";

// Cast or update the current user's stage vote, recompute the seed's displayed
// stage from the dominant vote, and fire a bloom if the threshold is crossed.
export async function castStageVote(
  userId: string,
  seedId: string,
  stage: string,
) {
  const seed = await db.seed.findUnique({ where: { id: seedId } });
  if (!seed || seed.deletedAt) throw new ApiError("NOT_FOUND", "Seed not found");
  // Only block voting if the seed has *really* bloomed (has a bloom). A phantom
  // "bloomed" stage with no bloom is allowed through so it can self-heal below.
  if (seed.stage === "bloomed" && seed.bloomId) {
    throw new ApiError("CONFLICT", "This seed has already bloomed");
  }
  await ensureSeedParticipant(userId, seedId);

  await db.seedStageVote.upsert({
    where: { seedId_userId: { seedId, userId } },
    update: { stage, votedAt: new Date() },
    create: { seedId, userId, stage },
  });

  const [distribution, participants] = await Promise.all([
    stageDistribution(seedId),
    countParticipants(seedId),
  ]);

  // Displayed stage = the most-voted stage, ties resolving to the more advanced
  // one ("momentum"). CRITICAL: never let votes alone set "bloomed" — a seed
  // only truly blooms by creating a bloom (the shouldBloom branch below). If
  // "bloomed" is dominant but the threshold isn't met, it caps at "growing".
  let dominant = seed.stage === "bloomed" ? "growing" : seed.stage;
  let best = -1;
  for (const key of STAGE_KEYS) {
    if (key === "bloomed") continue; // bloomed is never a vote-driven display stage
    const d = distribution.find((x) => x.stage === key)!;
    if (d.votes >= best) {
      best = d.votes;
      dominant = key;
    }
  }

  // Blooms when bloom votes reach 2, or half the participants — whichever is more.
  const bloomed = distribution.find((d) => d.stage === "bloomed")!;
  const shouldBloom = bloomed.votes >= bloomTargetFor(participants);

  if (shouldBloom) {
    let bloomId: string;
    try {
      const bloom = await createBloom(userId, seedId, userId);
      bloomId = bloom.id;
    } catch (err) {
      // A concurrent vote may have bloomed it first — recover its id so the
      // person who tipped it still gets the celebration instead of an error.
      const existing = await db.bloom.findFirst({
        where: { seedId },
        orderBy: { version: "desc" },
        select: { id: true },
      });
      if (!existing) throw err;
      bloomId = existing.id;
    }
    return {
      distribution: await stageDistribution(seedId),
      stage: "bloomed",
      bloomed: true,
      bloomId,
    };
  }

  if (dominant !== seed.stage) {
    await db.seed.update({ where: { id: seedId }, data: { stage: dominant } });
  }

  return { distribution, stage: dominant, bloomed: false, bloomId: null };
}
