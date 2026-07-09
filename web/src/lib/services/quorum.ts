import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { ensureSeedParticipant, requireSeedManager } from "@/lib/authz";
import {
  QUORUM_MAX_RANK,
  QUORUM_TEMPLATES,
  quorumTemplate,
  type QuorumDimension,
} from "@/lib/constants";
import { computeQuorum, type EqualMap, type Gap, type Hardcodes, type Rankings } from "@/lib/quorum";
import { spotLearningMoments, type ContribForAI, type LearningMoment } from "@/lib/ai";
import { listSeedPeople, type SeedPerson } from "./members";
import { notifySeedAudience } from "@/lib/services/seed-notify";

type Phase = "collecting" | "revealed" | "locked";

// Resolve a seed's Quorum purpose + cached observations. Progressive fallback so
// any subset of the newer columns (template, observations) not being migrated
// yet never breaks the read — it just degrades to defaults.
type QuorumStateLite = { phase: Phase; template: string; observations: unknown };
async function loadQuorumState(seedId: string): Promise<QuorumStateLite> {
  try {
    const row = await db.quorumState.findUnique({
      where: { seedId },
      select: { phase: true, template: true, observations: true },
    });
    return {
      phase: (row?.phase as Phase) ?? "collecting",
      template: row?.template ?? "decide",
      observations: row?.observations ?? null,
    };
  } catch {
    /* observations column not migrated yet */
  }
  try {
    const row = await db.quorumState.findUnique({
      where: { seedId },
      select: { phase: true, template: true },
    });
    return { phase: (row?.phase as Phase) ?? "collecting", template: row?.template ?? "decide", observations: null };
  } catch {
    /* template column not migrated yet */
  }
  const row = await db.quorumState
    .findUnique({ where: { seedId }, select: { phase: true } })
    .catch(() => null);
  return { phase: (row?.phase as Phase) ?? "collecting", template: "decide", observations: null };
}

// Coerce stored JSON into LearningMoment[] defensively.
function asMoments(v: unknown): LearningMoment[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (m): m is LearningMoment =>
      !!m && typeof m === "object" && typeof (m as LearningMoment).person === "string",
  );
}

// JSON columns come back loosely typed; coerce defensively against bad data.
// A ballot is stored either as a bare ordered array (ranked) or, when the rater
// chose "spread equally", as { equal: true, ids: [...] } — handle both.
function asIdList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (v && typeof v === "object" && Array.isArray((v as { ids?: unknown }).ids)) {
    return (v as { ids: unknown[] }).ids.filter((x): x is string => typeof x === "string");
  }
  return [];
}
function asEqual(v: unknown): boolean {
  return !!(v && typeof v === "object" && !Array.isArray(v) && (v as { equal?: unknown }).equal === true);
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
function cleanRanking(
  dimension: string,
  ranking: unknown,
  validIds: Set<string>,
  dimSet: Set<string>,
): string[] {
  if (!dimSet.has(dimension)) throw new ApiError("BAD_REQUEST", "Unknown dimension.");
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
  template: string;
  templateLabel: string;
  dimensions: readonly QuorumDimension[];
  maxRank: number;
  // your own draft/submitted ballots, dimension -> ordered ids
  mine: Record<string, string[]>;
  // which of your dimensions are in "spread equally" mode
  mineEqual: Record<string, boolean>;
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
    // "What Claude noticed" — only for Understand-together quorums.
    observations: LearningMoment[];
  };
};

// Everything the quorum screen needs for one viewer. Public pies/weights/
// tensions appear once revealed; the self-vs-room gap is returned only for the
// viewer (never the whole room's), so the private mirror stays private.
export async function getQuorumView(userId: string, seedId: string): Promise<QuorumView> {
  await ensureSeedParticipant(userId, seedId);
  const { people, canManage, ownerId } = await listSeedPeople(userId, seedId);
  const peopleIds = people.map((p) => p.id);

  const [state, myRows, submittedRows, hardcodeRows] = await Promise.all([
    loadQuorumState(seedId),
    db.quorumBallot.findMany({ where: { seedId, raterId: userId } }),
    db.quorumBallot.findMany({ where: { seedId, submitted: true } }),
    db.quorumHardcode.findMany({
      where: { seedId },
      include: { by: { select: { name: true } } },
    }),
  ]);

  const phase: Phase = state.phase;
  const tmpl = quorumTemplate(state.template);
  const dimKeys = tmpl.dimensions.map((d) => d.key);

  const mine: Record<string, string[]> = {};
  const mineEqual: Record<string, boolean> = {};
  let youSubmitted = false;
  for (const b of myRows) {
    mine[b.dimension] = asIdList(b.ranking);
    mineEqual[b.dimension] = asEqual(b.ranking);
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
    const equalMap: EqualMap = {};
    for (const b of submittedRows) {
      (rankings[b.raterId] ??= {})[b.dimension] = asIdList(b.ranking);
      (equalMap[b.raterId] ??= {})[b.dimension] = asEqual(b.ranking);
    }
    const full = computeQuorum(peopleIds, rankings, engineHardcodes, equalMap, dimKeys);
    result = {
      weights: full.weights,
      dimensionPies: full.dimensionPies,
      dimensionLeader: full.dimensionLeader,
      hardcodedBy: full.hardcodedBy,
      carriesId: full.carriesId,
      tensions: full.tensions,
      myGap: full.gaps[userId] ?? [],
      observations: tmpl.key === "understand" ? asMoments(state.observations) : [],
    };
  }

  return {
    phase,
    canManage,
    ownerId,
    people,
    template: tmpl.key,
    templateLabel: tmpl.label,
    dimensions: tmpl.dimensions,
    maxRank: QUORUM_MAX_RANK,
    mine,
    mineEqual,
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
  const state = await loadQuorumState(seedId);
  if (state.phase === "locked") {
    throw new ApiError("BAD_REQUEST", "This quorum is locked — weigh-in is closed.");
  }
  const dimKeys = quorumTemplate(state.template).dimensions.map((d) => d.key);
  const dimSet = new Set<string>(dimKeys);

  const { people } = await listSeedPeople(userId, seedId);
  const validIds = new Set(people.map((p) => p.id));

  // Clean every dimension up front so a bad one fails the whole save atomically.
  // `equal` rides along: when set, we store { equal: true, ids } instead of a
  // bare array so the engine flattens that dimension's weights.
  const cleaned: { dimension: string; ids: string[]; equal: boolean }[] = [];
  for (const dim of dimKeys) {
    if (!(dim in ballots)) continue;
    cleaned.push({
      dimension: dim,
      ids: cleanRanking(dim, ballots[dim], validIds, dimSet),
      equal: asEqual(ballots[dim]),
    });
  }
  if (submit) {
    const ranked = new Set(cleaned.filter((c) => c.ids.length > 0).map((c) => c.dimension));
    const missing = dimKeys.filter((d) => !ranked.has(d));
    if (missing.length > 0) {
      throw new ApiError("BAD_REQUEST", "Rank at least one person in every dimension before submitting.");
    }
  }

  // The JSON we persist: equal dimensions as { equal, ids }, ranked as a plain array.
  const stored = (c: { ids: string[]; equal: boolean }) =>
    c.equal ? { equal: true, ids: c.ids } : c.ids;

  await db.$transaction(
    cleaned.map((c) =>
      db.quorumBallot.upsert({
        where: { seedId_raterId_dimension: { seedId, raterId: userId, dimension: c.dimension } },
        update: { ranking: stored(c), submitted: submit },
        create: { seedId, raterId: userId, dimension: c.dimension, ranking: stored(c), submitted: submit },
      }),
    ),
  );

  // Auto-reveal: the moment the last participant commits, flip to revealed — no
  // admin approval needed. (An admin can still reveal early via the admin bar.)
  let revealed = false;
  if (submit && state.phase === "collecting" && people.length > 0) {
    const submitters = await db.quorumBallot.findMany({
      where: { seedId, submitted: true },
      distinct: ["raterId"],
      select: { raterId: true },
    });
    if (submitters.length >= people.length) {
      await db.quorumState.upsert({
        where: { seedId },
        update: { phase: "revealed" },
        create: { seedId, phase: "revealed", template: state.template },
      });
      revealed = true;
      if (state.template === "understand") {
        try {
          await generateObservations(seedId);
        } catch (err) {
          console.error("[quorum] auto-reveal observations failed", err);
        }
      }
      // Everyone's in — announce the result (the actor is the last submitter).
      await announceQuorumReveal(seedId, userId, state.template);
    } else {
      // Not everyone yet — it's now the remaining people's turn. Ping the seed's
      // people who HAVEN'T weighed in, so a decision doesn't stall waiting on them.
      try {
        const submitterIds = (submitters as { raterId: string }[]).map((s) => s.raterId);
        const [seedRow, actor] = await Promise.all([
          db.seed.findUnique({ where: { id: seedId }, select: { title: true, createdById: true } }),
          db.user.findUnique({ where: { id: userId }, select: { name: true } }),
        ]);
        if (seedRow) {
          await notifySeedAudience({
            actorId: userId,
            seed: { id: seedId, title: seedRow.title, createdById: seedRow.createdById },
            type: "weigh_in",
            title: "It's your turn to weigh in ⚖️",
            body: `${actor?.name || "Someone"} weighed in — add your voice on “${seedRow.title}”.`,
            exclude: submitterIds, // people who've already committed (incl. the actor)
          });
        }
      } catch (err) {
        console.error("[quorum] weigh-in turn notify failed", err);
      }
    }
  }
  return { ok: true, submitted: submit, revealed };
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
  const state = await loadQuorumState(seedId);
  const measurable = new Set(
    quorumTemplate(state.template).dimensions.filter((d) => d.measurable).map((d) => d.key),
  );
  if (!measurable.has(dimension)) {
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

// "What Claude noticed" — read the whole thread and surface grounded, attributed
// learning moments, cached on the quorum. Best-effort: generated at reveal for
// Understand-together quorums, never blocks the reveal on failure.
async function generateObservations(seedId: string): Promise<void> {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    select: {
      title: true,
      content: true,
      contributions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 300,
        select: { dimension: true, content: true, author: { select: { name: true } } },
      },
    },
  });
  if (!seed) return;
  const contributions: ContribForAI[] = seed.contributions
    .map((c: { dimension: string; content: unknown; author: { name: string | null } }) => ({
      dimension: c.dimension,
      author: c.author.name || "A member",
      text: (c.content as { text?: string } | null)?.text ?? "",
    }))
    .filter((c: ContribForAI) => c.text.trim().length > 0);
  if (contributions.length === 0) return;
  const participants = Array.from(new Set(contributions.map((c) => c.author)));
  const moments = await spotLearningMoments({
    title: seed.title,
    content: seed.content,
    contributions,
    participants,
  });
  await db.quorumState.update({ where: { seedId }, data: { observations: moments } }).catch(() => {});
}

// Move the board between collecting -> revealed -> locked. Manager-only.
export async function setPhase(userId: string, seedId: string, phase: string) {
  await requireSeedManager(userId, seedId);
  if (phase !== "collecting" && phase !== "revealed" && phase !== "locked") {
    throw new ApiError("BAD_REQUEST", "Unknown phase.");
  }
  // Was it already revealed? So we only announce the *first* reveal, not a
  // reopen-then-reveal.
  const prev = await db.quorumState
    .findUnique({ where: { seedId }, select: { phase: true } })
    .catch(() => null);
  await db.quorumState.upsert({
    where: { seedId },
    update: { phase },
    create: { seedId, phase },
  });
  // On reveal of an Understand-together quorum, spot the human moments Claude saw.
  if (phase === "revealed") {
    const state = await loadQuorumState(seedId);
    if (state.template === "understand") {
      try {
        await generateObservations(seedId);
      } catch (err) {
        console.error("[quorum] generateObservations failed", err);
      }
    }
    // Tell everyone in the seed the result is in — this is the payoff moment.
    // Only on the first reveal (not a reopen-then-reveal).
    if (prev?.phase !== "revealed") {
      await announceQuorumReveal(seedId, userId, state.template);
    }
  }
  return { ok: true, phase };
}

// The result is in — announce it to everyone in the seed, over push. Shared by
// the admin's manual reveal and the automatic reveal when the last person
// submits, so the payoff moment is never silent whichever way it happens.
async function announceQuorumReveal(seedId: string, actorId: string, template: string) {
  const seed = await db.seed.findUnique({
    where: { id: seedId },
    select: { id: true, title: true, createdById: true },
  });
  if (!seed) return;
  const understand = template === "understand";
  await notifySeedAudience({
    actorId,
    seed,
    type: "stage_change",
    title: understand
      ? `See who helped it click — “${seed.title}”`
      : `The result is in — “${seed.title}”`,
    body: understand
      ? "The recognition is in. See what the group noticed in each of you 🌱"
      : "Everyone's read is in — see who's really carrying this one.",
  });
}

// Choose the Quorum's purpose (dimension set). Manager-only, and only while
// still collecting — switching purpose changes the dimensions, so we reset the
// weigh-in (ballots + hardcodes) for a clean start rather than orphan them.
export async function setQuorumTemplate(userId: string, seedId: string, template: string) {
  await requireSeedManager(userId, seedId);
  if (!(template in QUORUM_TEMPLATES)) {
    throw new ApiError("BAD_REQUEST", "Unknown template.");
  }
  const state = await loadQuorumState(seedId);
  if (state.phase !== "collecting") {
    throw new ApiError("BAD_REQUEST", "Change the purpose before revealing the quorum.");
  }
  if (state.template === template) return { ok: true, template };

  await db.$transaction([
    db.quorumBallot.deleteMany({ where: { seedId } }),
    db.quorumHardcode.deleteMany({ where: { seedId } }),
    db.quorumState.upsert({
      where: { seedId },
      update: { template },
      create: { seedId, template, phase: "collecting" },
    }),
  ]);
  return { ok: true, template };
}
