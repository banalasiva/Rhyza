import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureSeedParticipant, requireSeedManager } from "@/lib/authz";
import { QUORUM_DIMENSION_KEYS, QUORUM_DIMENSIONS, QUORUM_MAX_RANK } from "@/lib/constants";
import { computeQuorum, type Gap, type Hardcodes, type Rankings } from "@/lib/quorum";
import { listSeedPeople, type SeedPerson } from "./members";

const DIM_SET = new Set<string>(QUORUM_DIMENSION_KEYS);
const MEASURABLE = new Set<string>(QUORUM_DIMENSIONS.filter((d) => d.measurable).map((d) => d.key));
type Phase = "collecting" | "revealed" | "locked";

// JSON columns come back loosely typed; coerce defensively against bad data.
function asIdList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asShares(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === "number" && isFinite(n) && n >= 0) out[k] = n;
    }
  }
  return out;
}

// Validate one ballot: a dimension we know, an ordered list of distinct people
// who are all participants, no longer than the cap, and not ranking nobody.
function cleanRanking(dimension: string, ranking: unknown, validIds: Set<string>): string[] {
  if (!DIM_SET.has(dimension)) throw new ApiError("BAD_REQUEST", "Unknown dimension.");
  const list = asIdList(ranking);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of list) {
    if (!validIds.has(id)) throw new ApiError("BAD_REQUEST", "Ranked someone who isn't in this seed.");
    if (seen.has(id)) continue; // drop accidental duplicates
    seen.add(id);
    out.push(id);
  }
  if (out.length > QUORUM_MAX_RANK) {
    throw new ApiError("BAD_REQUEST", `You can rank at most ${QUORUM_MAX_RANK} people.`);
  }
  return out;
}

export type QuorumView = {
  phase: Phase;
  canManage: boolean;
  ownerId: string;
  people: SeedPerson[];
  dimensions: typeof QUORUM_DIMENSIONS;
  maxRank: number;
  // your own draft/submitted ballots, dimension -> ordered ids
  mine: Record<string, string[]>;
  youSubmitted: boolean;
  submittedCount: number; // how many people have committed their weigh-in
  totalPeople: number;
  hardcodes: Record<string, { byName: string; shares: Record<string, number> }>;
  // present only once revealed/locked; each viewer sees only their own gap
  result: null | {
    weights: Record<string, number>;
    dimensionPies: Record<string, Record<string, number>>;
    dimensionLeader: Record<string, string | null>;
    hardcodedBy: Record<string, string | null>;
    carriesId: string | null;
    tensions: { text: string }[];
    myGap: Gap[];
  };
};

// Everything the quorum screen needs for one viewer. Public pies/weights/
// tensions appear once revealed; the self-vs-room gap is returned only for the
// viewer (never the whole room's), so the private mirror stays private.
export async function getQuorumView(userId: string, seedId: string): Promise<QuorumView> {
  await ensureSeedParticipant(userId, seedId);
  const { people, canManage, ownerId } = await listSeedPeople(userId, seedId);
  const peopleIds = people.map((p) => p.id);

  const [stateRow, myRows, submittedRows, hardcodeRows] = await Promise.all([
    db.quorumState.findUnique({ where: { seedId } }),
    db.quorumBallot.findMany({ where: { seedId, raterId: userId } }),
    db.quorumBallot.findMany({ where: { seedId, submitted: true } }),
    db.quorumHardcode.findMany({
      where: { seedId },
      include: { by: { select: { name: true } } },
    }),
  ]);

  const phase: Phase = (stateRow?.phase as Phase) ?? "collecting";

  const mine: Record<string, string[]> = {};
  let youSubmitted = false;
  for (const b of myRows) {
    mine[b.dimension] = asIdList(b.ranking);
    if (b.submitted) youSubmitted = true;
  }

  const submittedRaters = new Set<string>();
  for (const b of submittedRows) submittedRaters.add(b.raterId);

  const hardcodes: Record<string, { byName: string; shares: Record<string, number> }> = {};
  const engineHardcodes: Hardcodes = {};
  for (const h of hardcodeRows) {
    const shares = asShares(h.shares);
    const byName = h.by?.name || "An admin";
    hardcodes[h.dimension] = { byName, shares };
    engineHardcodes[h.dimension] = { byId: h.byId, byName, shares };
  }

  let result: QuorumView["result"] = null;
  if (phase === "revealed" || phase === "locked") {
    const rankings: Rankings = {};
    for (const b of submittedRows) {
      (rankings[b.raterId] ??= {})[b.dimension] = asIdList(b.ranking);
    }
    const full = computeQuorum(peopleIds, rankings, engineHardcodes);
    result = {
      weights: full.weights,
      dimensionPies: full.dimensionPies,
      dimensionLeader: full.dimensionLeader,
      hardcodedBy: full.hardcodedBy,
      carriesId: full.carriesId,
      tensions: full.tensions,
      myGap: full.gaps[userId] ?? [],
    };
  }

  return {
    phase,
    canManage,
    ownerId,
    people,
    dimensions: QUORUM_DIMENSIONS,
    maxRank: QUORUM_MAX_RANK,
    mine,
    youSubmitted,
    submittedCount: submittedRaters.size,
    totalPeople: peopleIds.length,
    hardcodes,
    result,
  };
}

// Save (and optionally commit) the viewer's weigh-in across the six dimensions.
// `ballots` maps dimension -> ordered ids; a missing dimension clears that one.
// submit=true marks every saved dimension as committed (folds into the result).
export async function saveWeighIn(
  userId: string,
  seedId: string,
  ballots: Record<string, unknown>,
  submit: boolean,
) {
  await ensureSeedParticipant(userId, seedId);
  const state = await db.quorumState.findUnique({ where: { seedId } });
  if (state?.phase === "locked") {
    throw new ApiError("BAD_REQUEST", "This quorum is locked — weigh-in is closed.");
  }

  const { people } = await listSeedPeople(userId, seedId);
  const validIds = new Set(people.map((p) => p.id));

  // Clean every dimension up front so a bad one fails the whole save atomically.
  const cleaned: { dimension: string; ranking: string[] }[] = [];
  for (const dim of QUORUM_DIMENSION_KEYS) {
    if (!(dim in ballots)) continue;
    cleaned.push({ dimension: dim, ranking: cleanRanking(dim, ballots[dim], validIds) });
  }
  if (submit) {
    const ranked = new Set(cleaned.filter((c) => c.ranking.length > 0).map((c) => c.dimension));
    const missing = QUORUM_DIMENSION_KEYS.filter((d) => !ranked.has(d));
    if (missing.length > 0) {
      throw new ApiError("BAD_REQUEST", "Rank at least one person in every dimension before submitting.");
    }
  }

  await db.$transaction(
    cleaned.map((c) =>
      db.quorumBallot.upsert({
        where: { seedId_raterId_dimension: { seedId, raterId: userId, dimension: c.dimension } },
        update: { ranking: c.ranking, submitted: submit },
        create: { seedId, raterId: userId, dimension: c.dimension, ranking: c.ranking, submitted: submit },
      }),
    ),
  );
  return { ok: true, submitted: submit };
}

// Admin pins a measurable dimension (money / consequence) to a ground truth.
// shares is a map of userId -> non-negative number; the engine normalises it.
export async function setHardcode(
  userId: string,
  seedId: string,
  dimension: string,
  shares: Record<string, unknown>,
) {
  await requireSeedManager(userId, seedId);
  if (!MEASURABLE.has(dimension)) {
    throw new ApiError("BAD_REQUEST", "Only measurable dimensions can be hardcoded.");
  }
  const { people } = await listSeedPeople(userId, seedId);
  const validIds = new Set(people.map((p) => p.id));
  const clean = asShares(shares);
  for (const id of Object.keys(clean)) {
    if (!validIds.has(id)) throw new ApiError("BAD_REQUEST", "Shares reference someone not in this seed.");
  }
  const total = Object.values(clean).reduce((a, b) => a + b, 0);
  if (total <= 0) throw new ApiError("BAD_REQUEST", "Give at least one person a positive share.");

  await db.quorumHardcode.upsert({
    where: { seedId_dimension: { seedId, dimension } },
    update: { byId: userId, shares: clean },
    create: { seedId, dimension, byId: userId, shares: clean },
  });
  return { ok: true };
}

export async function clearHardcode(userId: string, seedId: string, dimension: string) {
  await requireSeedManager(userId, seedId);
  await db.quorumHardcode.deleteMany({ where: { seedId, dimension } });
  return { ok: true };
}

// Move the board between collecting -> revealed -> locked. Manager-only.
export async function setPhase(userId: string, seedId: string, phase: string) {
  await requireSeedManager(userId, seedId);
  if (phase !== "collecting" && phase !== "revealed" && phase !== "locked") {
    throw new ApiError("BAD_REQUEST", "Unknown phase.");
  }
  await db.quorumState.upsert({
    where: { seedId },
    update: { phase },
    create: { seedId, phase },
  });
  return { ok: true, phase };
}
