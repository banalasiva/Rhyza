// Stake-weighted quorum — the pure math, kept side-effect free so it can be
// reasoned about and tested in isolation.
//
// The whole pipeline, in five steps (mirrors the product design):
//   1. Collect    — each rater scores each person on each dimension, 0–100.
//   2. Average    — for every (person, dimension) take the mean across raters.
//   3. Active     — keep only the dimensions the group left active for this seed.
//   4. Per-dim pie — within one dimension, normalise across people so it sums to
//                    100%. (This is why equal money adds no differentiation — if
//                    everyone scores the same, everyone's slice is equal.)
//   5. Combine    — a person's weight = mean of their shares across active
//                    dimensions, normalised so all weights sum to 100%.
//
// Opting out ("not required for me") is applied last: we compute everyone's
// weight *including* the opt-outs, then hand each opt-out's weight to the
// remaining quorum in EQUAL parts — a gift to the commons, not a proportional
// handback to the already-powerful.

import { STAKE_DIMENSION_KEYS } from "@/lib/constants";

export type ScoreMap = Record<string, number>; // dimension key -> 0..100

export type StakeProfile = {
  userId: string;
  // Per active dimension: this person's share of that dimension (0..100).
  dims: Record<string, number>;
  // Overall bloom weight (0..100). All non-opted weights sum to ~100.
  weight: number;
  optedOut: boolean;
  // How many raters actually scored this person (drives "n raters" hints).
  raterCount: number;
};

export type ComputeInput = {
  participants: string[];
  activeDimensions: string[];
  // ratings[raterId][rateeId] = { dim: score }. Only submitted ratings belong here.
  ratings: Record<string, Record<string, ScoreMap>>;
  optOuts: string[];
};

export function computeStakeWeights(input: ComputeInput): StakeProfile[] {
  const { participants, ratings, optOuts } = input;
  const dims = input.activeDimensions.filter((d) =>
    (STAKE_DIMENSION_KEYS as string[]).includes(d),
  );
  const optSet = new Set(optOuts);

  // Step 2: mean score per (ratee, dim); also remember how many raters weighed in.
  const avg: Record<string, Record<string, number>> = {};
  const raterCount: Record<string, number> = {};
  for (const ratee of participants) {
    avg[ratee] = {};
    const ratersForRatee = new Set<string>();
    for (const dim of dims) {
      let sum = 0;
      let n = 0;
      for (const rater of participants) {
        const s = ratings[rater]?.[ratee]?.[dim];
        if (typeof s === "number" && !Number.isNaN(s)) {
          sum += s;
          n++;
          ratersForRatee.add(rater);
        }
      }
      avg[ratee][dim] = n > 0 ? sum / n : 0;
    }
    raterCount[ratee] = ratersForRatee.size;
  }

  // Step 4: per-dimension pie across ALL participants (opt-outs included here so
  // their weight can be measured before being redistributed).
  const share: Record<string, Record<string, number>> = {};
  for (const p of participants) share[p] = {};
  for (const dim of dims) {
    let total = 0;
    for (const p of participants) total += avg[p][dim];
    for (const p of participants) {
      share[p][dim] =
        total > 0
          ? (avg[p][dim] / total) * 100
          : participants.length
            ? 100 / participants.length
            : 0;
    }
  }

  // Step 5: weight = mean of shares across active dims, normalised to 100.
  const weightAll: Record<string, number> = {};
  let wsum = 0;
  for (const p of participants) {
    let w = 0;
    for (const dim of dims) w += share[p][dim];
    w = dims.length > 0 ? w / dims.length : participants.length ? 100 / participants.length : 0;
    weightAll[p] = w;
    wsum += w;
  }
  for (const p of participants) {
    weightAll[p] = wsum > 0 ? (weightAll[p] / wsum) * 100 : 0;
  }

  // Opt-out redistribution: vacated weight shared EQUALLY among the quorum.
  const remaining = participants.filter((p) => !optSet.has(p));
  let vacated = 0;
  for (const p of participants) if (optSet.has(p)) vacated += weightAll[p];
  const bonus = remaining.length > 0 ? vacated / remaining.length : 0;

  return participants.map((p) => ({
    userId: p,
    dims: share[p],
    weight: optSet.has(p) ? 0 : weightAll[p] + bonus,
    optedOut: optSet.has(p),
    raterCount: raterCount[p] ?? 0,
  }));
}

// Given the computed weights and the set of people who voted "bloom", how much
// of the total stake has said yes — and has the threshold been crossed?
export function stakeYesShare(
  profiles: StakeProfile[],
  yesVoterIds: Set<string>,
): { yesWeight: number; totalWeight: number; pct: number; yesVoters: number } {
  let yesWeight = 0;
  let totalWeight = 0;
  let yesVoters = 0;
  for (const p of profiles) {
    totalWeight += p.weight;
    if (yesVoterIds.has(p.userId)) {
      yesWeight += p.weight;
      if (p.weight > 0) yesVoters++;
    }
  }
  const pct = totalWeight > 0 ? (yesWeight / totalWeight) * 100 : 0;
  return { yesWeight, totalWeight, pct, yesVoters };
}
