import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureSeedParticipant } from "@/lib/authz";
import { bloomTargetFor, STAGE_KEYS, STAGES, stageIndex } from "@/lib/constants";
import { countParticipants, stageDistribution } from "@/lib/services/seeds";
import { createBloom } from "@/lib/services/blooms";
import { evaluateStakeBloom } from "@/lib/services/stake";
import { deliver } from "@/lib/services/notify";

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

  // Was this a new signal, and which way did it move? Compared against the
  // seed's currently-displayed stage so we can tell the thread whether this
  // person feels the conversation is converging (forward) or diverging (back).
  const prev = await db.seedStageVote.findUnique({
    where: { seedId_userId: { seedId, userId } },
    select: { stage: true },
  });

  await db.seedStageVote.upsert({
    where: { seedId_userId: { seedId, userId } },
    update: { stage, votedAt: new Date() },
    create: { seedId, userId, stage },
  });

  const result = await settleStage(seedId, userId);

  // Tell everyone in the thread how this person now feels — but only when the
  // vote actually changed, so re-affirming the same stage stays quiet.
  if (!prev || prev.stage !== stage) {
    await notifyStageVote(
      userId,
      { id: seed.id, title: seed.title, createdById: seed.createdById },
      stage,
      seed.stage,
    );
  }

  return result;
}

// Notify the thread that someone weighed in on how ready the conversation
// feels. `fromStage` is the seed's displayed stage *before* this vote — the
// direction relative to it is what reads as converging / diverging.
async function notifyStageVote(
  actorId: string,
  seed: { id: string; title: string; createdById: string },
  votedStage: string,
  fromStage: string,
) {
  try {
    const start = new Date();
    const [participants, follows, members, actor] = await Promise.all([
      db.contribution.findMany({
        where: { seedId: seed.id, deletedAt: null },
        distinct: ["authorId"],
        select: { authorId: true },
      }),
      db.seedFollow.findMany({ where: { seedId: seed.id }, select: { userId: true } }),
      db.seedMember.findMany({ where: { seedId: seed.id }, select: { userId: true } }),
      db.user.findUnique({ where: { id: actorId }, select: { name: true } }),
    ]);

    const recipients = new Set<string>();
    const add = (id?: string | null) => {
      if (id && id !== actorId) recipients.add(id);
    };
    add(seed.createdById);
    for (const p of participants as { authorId: string }[]) add(p.authorId);
    for (const f of follows as { userId: string }[]) add(f.userId);
    for (const m of members as { userId: string }[]) add(m.userId);
    if (recipients.size === 0) return;

    const name = actor?.name || "Someone";
    const to = STAGES.find((s) => s.key === votedStage) ?? STAGES[0];
    const dir = stageIndex(votedStage) - stageIndex(fromStage);
    const body =
      dir > 0
        ? `${name} feels this is converging → ${to.emoji} ${to.label}`
        : dir < 0
          ? `${name} feels this is diverging — back to ${to.emoji} ${to.label}`
          : `${name} agrees this feels ${to.emoji} ${to.label}`;
    const title = `Readiness shifting in “${seed.title}”`;
    const ids = [...recipients];

    await db.notification.createMany({
      data: ids.map((rid) => ({
        recipientId: rid,
        actorId,
        type: "stage_change",
        title,
        body,
        entityType: "seed",
        entityId: seed.id,
      })),
    });

    // Read back exactly the rows we just inserted (same actor + seed, created
    // after `start`) so push delivery stamps the right notifications.
    const rows = await db.notification.findMany({
      where: {
        type: "stage_change",
        entityId: seed.id,
        actorId,
        recipientId: { in: ids },
        createdAt: { gte: start },
      },
      select: { id: true, recipientId: true },
    });
    await deliver(
      (rows as { id: string; recipientId: string }[]).map((r) => ({
        notificationId: r.id,
        recipientId: r.recipientId,
        type: "stage_change",
        push: { title: `Readiness shifting in “${seed.title}”`, body },
        link: `/seeds/${seed.id}`,
      })),
    );
  } catch (err) {
    console.error("notifyStageVote failed", err);
  }
}

// Recompute the displayed stage from the current votes and fire a bloom if the
// quorum is met. Shared by human votes (castStageVote) and AI quorum votes —
// the vote is already recorded; this only settles the consequences.
export async function settleStage(seedId: string, triggeredById: string) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    select: { stage: true },
  });
  if (!seed) throw new ApiError("NOT_FOUND", "Seed not found");

  const [distribution, participants, stakeEval] = await Promise.all([
    stageDistribution(seedId),
    countParticipants(seedId),
    evaluateStakeBloom(seedId),
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

  // Bloom decision. When the seed's stake board is in use, the quorum is
  // stake-weighted: enough of the *stake* (not heads) must have voted bloom.
  // Otherwise fall back to the headcount target (2, or half the participants).
  const bloomed = distribution.find((d) => d.stage === "bloomed")!;
  const shouldBloom = stakeEval.configured
    ? stakeEval.reached
    : bloomed.votes >= bloomTargetFor(participants);

  if (shouldBloom) {
    let bloomId: string;
    try {
      const bloom = await createBloom(triggeredById, seedId, triggeredById);
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
