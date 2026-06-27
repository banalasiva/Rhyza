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
  if (seed.stage === "bloomed") {
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

  // Displayed stage = the stage with the most votes (ties resolve to the more
  // advanced stage, matching the prototype's "momentum" feel).
  let dominant = seed.stage;
  let best = -1;
  for (const key of STAGE_KEYS) {
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
    const bloom = await createBloom(userId, seedId, userId);
    return {
      distribution: await stageDistribution(seedId),
      stage: "bloomed",
      bloomed: true,
      bloomId: bloom.id,
    };
  }

  if (dominant !== seed.stage) {
    await db.seed.update({ where: { id: seedId }, data: { stage: dominant } });
  }

  return { distribution, stage: dominant, bloomed: false, bloomId: null };
}
