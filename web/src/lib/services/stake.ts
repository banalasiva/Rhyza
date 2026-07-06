import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireSeedAccess, ensureSeedParticipant, requireSeedManager } from "@/lib/authz";
import {
  STAKE_DIMENSION_KEYS,
  STAKE_BLOOM_THRESHOLD_PCT,
  BLOOM_MIN_VOTERS,
} from "@/lib/constants";
import { computeStakeWeights, stakeYesShare, type ScoreMap } from "@/lib/stake";

type RatingInput = { rateeId: string; scores: ScoreMap };

// ── helpers ──────────────────────────────────────────────────

// The people whose stake we weigh: the seed's planter + everyone who has
// contributed (Claude excluded — the AI participates but doesn't carry stake).
async function participantUsers(seedId: string) {
  const [seed, contribs] = await Promise.all([
    db.seed.findUnique({ where: { id: seedId }, select: { createdById: true } }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      select: { authorId: true },
      distinct: ["authorId"],
    }),
  ]);
  const ids = new Set<string>();
  if (seed) ids.add(seed.createdById);
  for (const c of contribs) ids.add(c.authorId);
  const users = await db.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, image: true },
  });
  return users.filter((u) => u.name !== "Claude");
}

// Profile A — how each person shaped the conversation, as a % across the five
// content dimensions. Free: contributions are already Claude-classified.
function contributionProfiles(rows: { authorId: string; dimension: string }[]) {
  const acc: Record<string, { total: number; counts: Record<string, number> }> = {};
  for (const r of rows) {
    (acc[r.authorId] ??= { total: 0, counts: {} }).total++;
    acc[r.authorId].counts[r.dimension] = (acc[r.authorId].counts[r.dimension] ?? 0) + 1;
  }
  const out: Record<string, { total: number; dims: Record<string, number> }> = {};
  for (const [id, v] of Object.entries(acc)) {
    const dims: Record<string, number> = {};
    for (const [d, n] of Object.entries(v.counts)) dims[d] = Math.round((n / v.total) * 100);
    out[id] = { total: v.total, dims };
  }
  return out;
}

function activeOf(stateRow: { activeDimensions: unknown } | null): string[] {
  const raw = (stateRow?.activeDimensions as string[]) ?? [];
  const clean = Array.isArray(raw)
    ? raw.filter((d) => (STAKE_DIMENSION_KEYS as string[]).includes(d))
    : [];
  return clean.length > 0 ? clean : [...STAKE_DIMENSION_KEYS];
}

function optOutsOf(stateRow: { optOuts: unknown } | null): string[] {
  const raw = (stateRow?.optOuts as string[]) ?? [];
  return Array.isArray(raw) ? raw : [];
}

async function ensureStakeState(seedId: string) {
  return db.seedStake.upsert({
    where: { seedId },
    update: {},
    create: { seedId, activeDimensions: [...STAKE_DIMENSION_KEYS] },
  });
}

// Can this user run consensus actions (rule a dimension N/A, reveal, lock)?
async function computeCanManage(
  userId: string,
  seed: { id: string; createdById: string; visibility: string; gardenId: string },
) {
  if (seed.createdById === userId) return true;
  const [seedMember, garden, gardenMember] = await Promise.all([
    db.seedMember.findUnique({ where: { seedId_userId: { seedId: seed.id, userId } } }),
    db.garden.findUnique({ where: { id: seed.gardenId }, select: { createdById: true } }),
    db.gardenMember.findUnique({ where: { gardenId_userId: { gardenId: seed.gardenId, userId } } }),
  ]);
  if (seed.visibility === "private") return seedMember?.role === "steward";
  return garden?.createdById === userId || gardenMember?.role === "steward";
}

// ── the board ────────────────────────────────────────────────

export type StakeBoard = Awaited<ReturnType<typeof getStakeBoard>>;

export async function getStakeBoard(userId: string, seedId: string) {
  const seed = await requireSeedAccess(userId, seedId);

  const [parts, stateRow, ratings, contribRows, votes, admissions] = await Promise.all([
    participantUsers(seedId),
    db.seedStake.findUnique({ where: { seedId } }),
    db.stakeRating.findMany({ where: { seedId } }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      select: { authorId: true, dimension: true },
    }),
    db.seedStageVote.findMany({ where: { seedId }, select: { userId: true, stage: true } }),
    db.stakeAdmission.findMany({
      where: { seedId, status: "pending" },
      include: { votes: true },
    }),
  ]);

  const partIds = parts.map((p) => p.id);
  const active = activeOf(stateRow);
  const optOuts = optOutsOf(stateRow).filter((id) => partIds.includes(id));
  const phase = stateRow?.phase ?? "collecting";

  // Build the submitted-ratings matrix + this viewer's own (possibly draft)
  // ratings, plus cross-out counts (who peers crossed) and my own crosses.
  const submittedMap: Record<string, Record<string, ScoreMap>> = {};
  const myRatings: Record<string, ScoreMap> = {};
  const crosses: Record<string, number> = {};
  const myCrosses = new Set<string>();
  const submittedRaters = new Set<string>();
  let iSubmitted = false;
  for (const r of ratings) {
    const scores = (r.scores as ScoreMap) ?? {};
    if (r.submitted) {
      (submittedMap[r.raterId] ??= {})[r.rateeId] = scores;
      submittedRaters.add(r.raterId);
    }
    if (r.crossed && r.raterId !== r.rateeId) {
      crosses[r.rateeId] = (crosses[r.rateeId] ?? 0) + 1;
      if (r.raterId === userId) myCrosses.add(r.rateeId);
    }
    if (r.raterId === userId) {
      myRatings[r.rateeId] = scores;
      if (r.submitted) iSubmitted = true;
    }
  }

  // Blind-then-reveal: hide everyone's stake until the manager reveals, or until
  // every participant has committed their ratings.
  const allSubmitted = partIds.length > 0 && partIds.every((id) => submittedRaters.has(id));
  const revealed = phase !== "collecting" || allSubmitted;

  const contrib = contributionProfiles(contribRows);
  const profiles = computeStakeWeights({
    participants: partIds,
    activeDimensions: active,
    ratings: submittedMap,
    optOuts,
    crosses,
  });
  const profById = new Map(profiles.map((p) => [p.userId, p]));
  const canManage = await computeCanManage(userId, seed);

  // Plain-language headline: who carries the decision. Only when revealed and
  // there's a meaningful leader.
  const ranked = [...profiles]
    .filter((p) => !p.optedOut && p.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const nameOf = (id: string) => parts.find((p) => p.id === id)?.name ?? "Someone";
  let carriesHeadline: string | null = null;
  if (revealed && ranked.length > 0) {
    const top = ranked[0];
    if (top.weight >= 45) carriesHeadline = `${nameOf(top.userId)} carries this decision`;
    else if (ranked.length >= 2 && top.weight + ranked[1].weight >= 60)
      carriesHeadline = `${nameOf(top.userId)} & ${nameOf(ranked[1].userId)} carry this decision`;
    else carriesHeadline = "This decision is carried broadly";
  }

  // Live stake-weighted bloom progress: how much of the total stake has voted
  // to bloom. Only meaningful once people have submitted ratings.
  const yesIds = new Set<string>(
    votes.filter((v) => v.stage === "bloomed").map((v) => String(v.userId)),
  );
  const yes = stakeYesShare(profiles, yesIds);
  const configured = submittedRaters.size > 0;

  // Pending newcomer-admission requests, tallied by the locked stake.
  const lockedIds = (stateRow?.lockedParticipants as string[]) ?? [];
  const weightOf = (id: string) => profById.get(id)?.weight ?? 0;
  const lockedTotal = lockedIds.reduce((s, id) => s + weightOf(id), 0);
  const iCarry = lockedIds.includes(userId) && weightOf(userId) > 0;
  const pendingAdmissions = admissions.map((a) => {
    const yesW = a.votes
      .filter((v) => v.approve && lockedIds.includes(v.voterId))
      .reduce((s, v) => s + weightOf(v.voterId), 0);
    const mine = a.votes.find((v) => v.voterId === userId);
    return {
      candidateId: a.candidateId,
      name: nameOf(a.candidateId),
      image: parts.find((p) => p.id === a.candidateId)?.image ?? null,
      approvalPct: lockedTotal > 0 ? Math.round((yesW / lockedTotal) * 100) : 0,
      iCanVote: iCarry && a.candidateId !== userId,
      myApprove: mine ? mine.approve : null,
    };
  });

  return {
    seedId,
    phase,
    revealed,
    locked: phase === "locked",
    activeDimensions: active,
    optOuts,
    iSubmitted,
    iOptedOut: optOuts.includes(userId),
    iVotedBloom: yesIds.has(userId),
    canManage,
    myRatings,
    myCrosses: [...myCrosses],
    carriesHeadline,
    pendingAdmissions,
    ratersSubmitted: submittedRaters.size,
    totalRaters: partIds.length,
    threshold: STAKE_BLOOM_THRESHOLD_PCT,
    bloomProgress: {
      configured,
      pct: revealed ? Math.round(yes.pct) : 0,
      threshold: STAKE_BLOOM_THRESHOLD_PCT,
      yesVoters: yes.yesVoters,
    },
    participants: parts.map((p) => {
      const prof = profById.get(p.id);
      return {
        id: p.id,
        name: p.name,
        image: p.image,
        isMe: p.id === userId,
        optedOut: optOuts.includes(p.id),
        hasSubmitted: submittedRaters.has(p.id),
        crossedBy: prof?.crossedBy ?? 0,
        iCrossed: myCrosses.has(p.id),
        contribution: contrib[p.id] ?? { total: 0, dims: {} },
        stake: revealed
          ? {
              dims: prof?.dims ?? {},
              weight: prof?.weight ?? 0,
              raterCount: prof?.raterCount ?? 0,
            }
          : null,
      };
    }),
  };
}

// ── mutations ────────────────────────────────────────────────

export async function submitStakeRatings(
  userId: string,
  seedId: string,
  ratings: RatingInput[],
  submit: boolean,
) {
  await ensureSeedParticipant(userId, seedId);
  await ensureStakeState(seedId);
  const clean = ratings.map((r) => ({
    rateeId: r.rateeId,
    scores: Object.fromEntries(
      Object.entries(r.scores)
        .filter(([k]) => (STAKE_DIMENSION_KEYS as string[]).includes(k))
        .map(([k, v]) => [k, Math.max(0, Math.min(100, Math.round(Number(v) || 0)))]),
    ),
  }));
  await db.$transaction(
    clean.map((r) =>
      db.stakeRating.upsert({
        where: { seedId_raterId_rateeId: { seedId, raterId: userId, rateeId: r.rateeId } },
        update: { scores: r.scores, submitted: submit },
        create: { seedId, raterId: userId, rateeId: r.rateeId, scores: r.scores, submitted: submit },
      }),
    ),
  );
  return getStakeBoard(userId, seedId);
}

// Consensus action: which dimensions are live for this seed (rest ruled N/A).
export async function setActiveDimensions(userId: string, seedId: string, dims: string[]) {
  await requireSeedManager(userId, seedId);
  const clean = dims.filter((d) => (STAKE_DIMENSION_KEYS as string[]).includes(d));
  await db.seedStake.upsert({
    where: { seedId },
    update: { activeDimensions: clean },
    create: { seedId, activeDimensions: clean },
  });
  return getStakeBoard(userId, seedId);
}

// "Not required for me" — a person removes their own stake; their weight is
// redistributed equally among the quorum (handled in the weight math).
export async function setOptOut(userId: string, seedId: string, optedOut: boolean) {
  await ensureSeedParticipant(userId, seedId);
  const state = await ensureStakeState(seedId);
  const set = new Set(optOutsOf(state));
  if (optedOut) set.add(userId);
  else set.delete(userId);
  await db.seedStake.update({ where: { seedId }, data: { optOuts: [...set] } });
  return getStakeBoard(userId, seedId);
}

// Peer cross-out: I flag that someone shouldn't carry this decision (or undo).
// Stored on my rating row for that person, so it rides alongside my scores.
export async function setCross(
  userId: string,
  seedId: string,
  rateeId: string,
  crossed: boolean,
) {
  if (rateeId === userId) throw new ApiError("BAD_REQUEST", "You can't cross out yourself");
  await ensureSeedParticipant(userId, seedId);
  await ensureStakeState(seedId);
  await db.stakeRating.upsert({
    where: { seedId_raterId_rateeId: { seedId, raterId: userId, rateeId } },
    update: { crossed },
    create: { seedId, raterId: userId, rateeId, crossed, scores: {} },
  });
  return getStakeBoard(userId, seedId);
}

// Manager reveals the map early, or locks it for the bloom vote. Locking
// snapshots the current quorum so we can detect later newcomers; unlocking
// clears that snapshot and any open admission requests.
export async function setStakePhase(
  userId: string,
  seedId: string,
  phase: "collecting" | "revealed" | "locked",
) {
  await requireSeedManager(userId, seedId);
  const lockedParticipants =
    phase === "locked" ? (await participantUsers(seedId)).map((p) => p.id) : [];
  await db.seedStake.upsert({
    where: { seedId },
    update: { phase, lockedParticipants },
    create: { seedId, phase, lockedParticipants, activeDimensions: [...STAKE_DIMENSION_KEYS] },
  });
  if (phase !== "locked") {
    await db.stakeAdmission.deleteMany({ where: { seedId, status: "pending" } });
  }
  return getStakeBoard(userId, seedId);
}

// Called when someone posts: if the board is LOCKED and they weren't in the
// locked quorum, open a pending admission request and notify the carriers.
// Never throws into the contribution path.
export async function requestAdmissionIfNeeded(seedId: string, candidateId: string) {
  try {
    const state = await db.seedStake.findUnique({ where: { seedId } });
    if (!state || state.phase !== "locked") return;
    const locked = (state.lockedParticipants as string[]) ?? [];
    if (locked.includes(candidateId)) return; // already a carrier

    const existing = await db.stakeAdmission.findUnique({
      where: { seedId_candidateId: { seedId, candidateId } },
    });
    if (existing) return; // one request per candidate

    const [candidate, seed, weights] = await Promise.all([
      db.user.findUnique({ where: { id: candidateId }, select: { name: true } }),
      db.seed.findUnique({ where: { id: seedId }, select: { title: true } }),
      getStakeWeightMap(seedId),
    ]);
    await db.stakeAdmission.create({ data: { seedId, candidateId } });

    // Notify the weighted carriers so they can vote on admitting the newcomer.
    const carriers = locked.filter((id) => (weights[id] ?? 0) > 0 && id !== candidateId);
    if (carriers.length > 0) {
      await db.notification.createMany({
        data: carriers.map((id) => ({
          recipientId: id,
          actorId: candidateId,
          type: "stake_admission",
          title: `${candidate?.name || "Someone"} wants into the decision`,
          body: seed?.title ?? "",
          entityType: "seed",
          entityId: seedId,
        })),
      });
    }
  } catch (err) {
    console.error("requestAdmissionIfNeeded failed", err);
  }
}

// A carrier votes to admit (or not) a newcomer. Once >50% of the locked stake
// approves, the board reopens (unlocks → revealed) so the whole quorum can
// re-weigh each other and fold the newcomer in.
export async function voteAdmission(
  userId: string,
  seedId: string,
  candidateId: string,
  approve: boolean,
) {
  const state = await db.seedStake.findUnique({ where: { seedId } });
  if (!state) throw new ApiError("NOT_FOUND", "No stake board");
  await ensureSeedParticipant(userId, seedId);
  const admission = await db.stakeAdmission.findUnique({
    where: { seedId_candidateId: { seedId, candidateId } },
  });
  if (!admission || admission.status !== "pending") {
    throw new ApiError("CONFLICT", "No open admission request");
  }
  const locked = (state.lockedParticipants as string[]) ?? [];
  const weights = await getStakeWeightMap(seedId);
  if (!locked.includes(userId) || (weights[userId] ?? 0) <= 0) {
    throw new ApiError("FORBIDDEN", "Only current decision-makers can vote on this");
  }

  await db.stakeAdmissionVote.upsert({
    where: { seedId_candidateId_voterId: { seedId, candidateId, voterId: userId } },
    update: { approve },
    create: { seedId, candidateId, voterId: userId, approve },
  });

  // Tally by stake. Admit once approvers hold > half the locked weight.
  const votes = await db.stakeAdmissionVote.findMany({ where: { seedId, candidateId } });
  const totalWeight = locked.reduce((s, id) => s + (weights[id] ?? 0), 0);
  const yesWeight = votes
    .filter((v) => v.approve)
    .reduce((s, v) => s + (weights[v.voterId] ?? 0), 0);

  if (totalWeight > 0 && yesWeight / totalWeight > 0.5) {
    await db.$transaction(async (tx) => {
      await tx.stakeAdmission.update({
        where: { seedId_candidateId: { seedId, candidateId } },
        data: { status: "admitted" },
      });
      // Reopen the board so everyone re-weighs each other.
      await tx.seedStake.update({
        where: { seedId },
        data: { phase: "revealed", lockedParticipants: [] },
      });
      const seed = await tx.seed.findUnique({ where: { id: seedId }, select: { title: true } });
      // Welcome the newcomer + nudge everyone to re-weigh.
      await tx.notification.create({
        data: {
          recipientId: candidateId,
          actorId: userId,
          type: "stake_admission",
          title: "You're in the decision quorum 🎉",
          body: seed?.title ?? "",
          entityType: "seed",
          entityId: seedId,
        },
      });
      await tx.notification.createMany({
        data: locked
          .filter((id) => id !== userId)
          .map((id) => ({
            recipientId: id,
            actorId: userId,
            type: "stake_admission",
            title: "The decision quorum reopened — re-weigh together",
            body: seed?.title ?? "",
            entityType: "seed",
            entityId: seedId,
          })),
      });
    });
  }

  return getStakeBoard(userId, seedId);
}

// Final bloom weight per user (0..100). Used by stake-weighted polls. Returns
// an empty map when no one has submitted ratings (caller falls back to equal).
export async function getStakeWeightMap(seedId: string): Promise<Record<string, number>> {
  const [stateRow, ratings, allRatings, parts] = await Promise.all([
    db.seedStake.findUnique({ where: { seedId } }),
    db.stakeRating.findMany({ where: { seedId, submitted: true } }),
    db.stakeRating.findMany({ where: { seedId, crossed: true }, select: { raterId: true, rateeId: true } }),
    participantUsers(seedId).then((u) => u.map((p) => p.id)),
  ]);
  if (ratings.length === 0) return {};
  const submittedMap: Record<string, Record<string, ScoreMap>> = {};
  for (const r of ratings) (submittedMap[r.raterId] ??= {})[r.rateeId] = (r.scores as ScoreMap) ?? {};
  const crosses: Record<string, number> = {};
  for (const r of allRatings) if (r.raterId !== r.rateeId) crosses[r.rateeId] = (crosses[r.rateeId] ?? 0) + 1;
  const profiles = computeStakeWeights({
    participants: parts,
    activeDimensions: activeOf(stateRow),
    ratings: submittedMap,
    optOuts: optOutsOf(stateRow).filter((id) => parts.includes(id)),
    crosses,
  });
  return Object.fromEntries(profiles.map((p) => [p.userId, p.weight]));
}

// ── bloom evaluation (used by voting) ────────────────────────

// Is the stake-weighted quorum reached? Returns configured:false when no one has
// submitted ratings yet, so the caller falls back to the headcount quorum.
export async function evaluateStakeBloom(seedId: string): Promise<{
  configured: boolean;
  reached: boolean;
  pct: number;
  yesVoters: number;
  threshold: number;
}> {
  const [stateRow, ratings, allRatings, votes, parts] = await Promise.all([
    db.seedStake.findUnique({ where: { seedId } }),
    db.stakeRating.findMany({ where: { seedId, submitted: true } }),
    db.stakeRating.findMany({ where: { seedId, crossed: true }, select: { raterId: true, rateeId: true } }),
    db.seedStageVote.findMany({ where: { seedId }, select: { userId: true, stage: true } }),
    participantUsers(seedId).then((u) => u.map((p) => p.id)),
  ]);

  // Stake-weighting governs the bloom only once the map is settled: the steward
  // locked it, or every participant has submitted their read. Until then the
  // ordinary headcount quorum applies (configured:false → caller falls back).
  const submittedRaters = new Set(ratings.map((r) => String(r.raterId)));
  const allSubmitted = parts.length > 0 && parts.every((id) => submittedRaters.has(id));
  const settled = stateRow?.phase === "locked" || allSubmitted;
  if (ratings.length === 0 || !settled) {
    return { configured: false, reached: false, pct: 0, yesVoters: 0, threshold: STAKE_BLOOM_THRESHOLD_PCT };
  }
  const active = activeOf(stateRow);
  const optOuts = optOutsOf(stateRow).filter((id) => parts.includes(id));

  const submittedMap: Record<string, Record<string, ScoreMap>> = {};
  for (const r of ratings) {
    (submittedMap[r.raterId] ??= {})[r.rateeId] = (r.scores as ScoreMap) ?? {};
  }
  const crosses: Record<string, number> = {};
  for (const r of allRatings) {
    if (r.raterId !== r.rateeId) crosses[r.rateeId] = (crosses[r.rateeId] ?? 0) + 1;
  }
  const profiles = computeStakeWeights({
    participants: parts,
    activeDimensions: active,
    ratings: submittedMap,
    optOuts,
    crosses,
  });
  const yesIds = new Set<string>(
    votes.filter((v) => v.stage === "bloomed").map((v) => String(v.userId)),
  );
  const { pct, yesVoters } = stakeYesShare(profiles, yesIds);

  // No minimum head-count: a single person carrying more than half the say can
  // bloom it alone. We still require at least one actual yes-voter so a seed
  // can't bloom with nobody having voted.
  const reached = pct >= STAKE_BLOOM_THRESHOLD_PCT && yesVoters >= BLOOM_MIN_VOTERS;

  return { configured: true, reached, pct, yesVoters, threshold: STAKE_BLOOM_THRESHOLD_PCT };
}
