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

  const [parts, stateRow, ratings, contribRows, votes] = await Promise.all([
    participantUsers(seedId),
    db.seedStake.findUnique({ where: { seedId } }),
    db.stakeRating.findMany({ where: { seedId } }),
    db.contribution.findMany({
      where: { seedId, deletedAt: null },
      select: { authorId: true, dimension: true },
    }),
    db.seedStageVote.findMany({ where: { seedId }, select: { userId: true, stage: true } }),
  ]);

  const partIds = parts.map((p) => p.id);
  const active = activeOf(stateRow);
  const optOuts = optOutsOf(stateRow).filter((id) => partIds.includes(id));
  const phase = stateRow?.phase ?? "collecting";

  // Build the submitted-ratings matrix + this viewer's own (possibly draft) ratings.
  const submittedMap: Record<string, Record<string, ScoreMap>> = {};
  const myRatings: Record<string, ScoreMap> = {};
  const submittedRaters = new Set<string>();
  let iSubmitted = false;
  for (const r of ratings) {
    const scores = (r.scores as ScoreMap) ?? {};
    if (r.submitted) {
      (submittedMap[r.raterId] ??= {})[r.rateeId] = scores;
      submittedRaters.add(r.raterId);
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
  });
  const profById = new Map(profiles.map((p) => [p.userId, p]));
  const canManage = await computeCanManage(userId, seed);

  // Live stake-weighted bloom progress: how much of the total stake has voted
  // to bloom. Only meaningful once people have submitted ratings.
  const yesIds = new Set<string>(
    votes.filter((v) => v.stage === "bloomed").map((v) => String(v.userId)),
  );
  const yes = stakeYesShare(profiles, yesIds);
  const configured = submittedRaters.size > 0;

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

// Manager reveals the map early, or locks it for the bloom vote.
export async function setStakePhase(
  userId: string,
  seedId: string,
  phase: "collecting" | "revealed" | "locked",
) {
  await requireSeedManager(userId, seedId);
  await db.seedStake.upsert({
    where: { seedId },
    update: { phase },
    create: { seedId, phase, activeDimensions: [...STAKE_DIMENSION_KEYS] },
  });
  return getStakeBoard(userId, seedId);
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
  const [stateRow, ratings, votes, parts] = await Promise.all([
    db.seedStake.findUnique({ where: { seedId } }),
    db.stakeRating.findMany({ where: { seedId, submitted: true } }),
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
  const profiles = computeStakeWeights({
    participants: parts,
    activeDimensions: active,
    ratings: submittedMap,
    optOuts,
  });
  const yesIds = new Set<string>(
    votes.filter((v) => v.stage === "bloomed").map((v) => String(v.userId)),
  );
  const { pct, yesVoters } = stakeYesShare(profiles, yesIds);

  // Headcount floor: normally needs ≥2 yes voters, but a sole non-opted carrier
  // can bloom alone (floor can't exceed the number of people who carry weight).
  const eligible = parts.filter((id) => !optOuts.includes(id)).length;
  const floor = Math.min(BLOOM_MIN_VOTERS, Math.max(1, eligible));
  const reached = pct >= STAKE_BLOOM_THRESHOLD_PCT && yesVoters >= floor;

  return { configured: true, reached, pct, yesVoters, threshold: STAKE_BLOOM_THRESHOLD_PCT };
}
