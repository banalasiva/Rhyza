// Quorum v2 — "emotions → maths".
//
// Everyone ranks everyone (themselves included) on each of the six dimensions by
// dragging the people who most embody it to the top (up to QUORUM_MAX_RANK). A
// rater's ranking becomes a set of position-weights that sum to 1, so every
// person is one equal voice no matter how many they ranked. For each dimension
// we sum those weights per person and normalise to a 100% pie; a person's final
// weight is the average of their six pie-shares. No cap.
//
// We also compute, per person, the GAP between how they placed themselves and
// how the room placed them — the private mirror — and surface notable public
// tensions (e.g. the people carrying the money aren't the ones trusted on the
// call). Pure functions, fully unit-testable.

import { QUORUM_DIMENSION_KEYS, QUORUM_DIMENSIONS } from "./constants";

// raterId -> dimensionKey -> ordered rateeIds (best first), length ≤ QUORUM_MAX_RANK
export type Rankings = Record<string, Record<string, string[]>>;
// raterId -> dimensionKey -> true when the rater chose "spread equally" for that
// dimension (everyone they listed counts the same, no ordering).
export type EqualMap = Record<string, Record<string, boolean>>;
// An admin override for a measurable dimension: shares by userId (any positive scale).
export type Hardcode = { byId: string; byName: string; shares: Record<string, number> };
export type Hardcodes = Record<string, Hardcode | undefined>;

export type Gap = {
  dimension: string;
  self: number | null; // 0..1, how high you placed yourself (null = you didn't)
  room: number; // 0..1, how high the room placed you
  direction: "above" | "below" | "aligned" | "unseen";
};

export type QuorumResult = {
  people: string[];
  weights: Record<string, number>; // final weight per person (sums to 1)
  dimensionPies: Record<string, Record<string, number>>; // dim -> userId -> share
  dimensionLeader: Record<string, string | null>;
  hardcodedBy: Record<string, string | null>; // dim -> admin name (or null)
  carriesId: string | null; // who carries the most
  gaps: Record<string, Gap[]>; // userId -> per-dimension self-vs-room
  tensions: { text: string }[];
};

// A ranking of length k gives the person at index i (best first) a weight that
// sums to 1 across the ranking: linear, top-heavy. When `equal` is set the rater
// said "spread equally" — everyone listed gets the same 1/k, order ignored. The
// per-rater total is 1 either way, so it stays one equal voice.
function positionWeights(ranking: string[], equal = false): Record<string, number> {
  const k = ranking.length;
  if (k === 0) return {};
  const out: Record<string, number> = {};
  if (equal) {
    ranking.forEach((id) => {
      out[id] = 1 / k;
    });
    return out;
  }
  const denom = (k * (k + 1)) / 2;
  ranking.forEach((id, i) => {
    out[id] = (k - i) / denom;
  });
  return out;
}

function normalize(scores: Record<string, number>): Record<string, number> {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [id, s] of Object.entries(scores)) out[id] = s / total;
  return out;
}

export function computeQuorum(
  peopleIds: string[],
  rankings: Rankings,
  hardcodes: Hardcodes = {},
  equalMap: EqualMap = {},
  dimensionKeys: readonly string[] = QUORUM_DIMENSION_KEYS,
): QuorumResult {
  const dims = dimensionKeys;
  const dimensionPies: Record<string, Record<string, number>> = {};
  const hardcodedBy: Record<string, string | null> = {};

  for (const dim of dims) {
    const hc = hardcodes[dim];
    if (hc) {
      dimensionPies[dim] = normalize(hc.shares);
      hardcodedBy[dim] = hc.byName;
      continue;
    }
    hardcodedBy[dim] = null;
    const raw: Record<string, number> = {};
    for (const raterId of Object.keys(rankings)) {
      const ranking = rankings[raterId]?.[dim];
      if (!ranking || ranking.length === 0) continue;
      const w = positionWeights(ranking, equalMap[raterId]?.[dim]);
      for (const [rateeId, wt] of Object.entries(w)) raw[rateeId] = (raw[rateeId] ?? 0) + wt;
    }
    dimensionPies[dim] = normalize(raw);
  }

  // Final weight = average of a person's share across the dimensions that have data.
  const activeDims = dims.filter((d) => Object.keys(dimensionPies[d]).length > 0);
  const weights: Record<string, number> = {};
  for (const id of peopleIds) {
    weights[id] =
      activeDims.length === 0
        ? 0
        : activeDims.reduce((a, d) => a + (dimensionPies[d][id] ?? 0), 0) / activeDims.length;
  }
  const wTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  if (wTotal > 0) for (const id of peopleIds) weights[id] /= wTotal;

  const dimensionLeader: Record<string, string | null> = {};
  for (const d of dims) {
    let best: string | null = null;
    let bestV = 0;
    for (const [id, v] of Object.entries(dimensionPies[d])) {
      if (v > bestV) {
        bestV = v;
        best = id;
      }
    }
    dimensionLeader[d] = best;
  }

  const carriesId = peopleIds.reduce<string | null>(
    (best, id) => (best === null || weights[id] > weights[best] ? id : best),
    null,
  );

  // Per-person gap: your self-placement vs the room's (others') placement.
  const gaps: Record<string, Gap[]> = {};
  for (const P of peopleIds) {
    const list: Gap[] = [];
    for (const dim of dims) {
      if (hardcodes[dim]) continue; // hardcoded dims have no self/room gap
      const myRanking = rankings[P]?.[dim];
      const self: number | null =
        myRanking && myRanking.length > 0
          ? positionWeights(myRanking, equalMap[P]?.[dim])[P] ?? 0
          : null;

      let roomSum = 0;
      let roomCount = 0;
      for (const raterId of Object.keys(rankings)) {
        if (raterId === P) continue;
        const r = rankings[raterId]?.[dim];
        if (!r || r.length === 0) continue;
        roomSum += positionWeights(r, equalMap[raterId]?.[dim])[P] ?? 0; // ranked others but not you → 0
        roomCount += 1;
      }
      const room = roomCount > 0 ? roomSum / roomCount : 0;

      let direction: Gap["direction"];
      if (self === null) direction = room > 0.05 ? "unseen" : "aligned";
      else {
        const diff = self - room;
        direction = diff > 0.12 ? "above" : diff < -0.12 ? "below" : "aligned";
      }
      list.push({ dimension: dim, self, room, direction });
    }
    gaps[P] = list;
  }

  // Public tensions: a stake leader who isn't the judgement leader.
  const tensions: { text: string }[] = [];
  const label = (k: string) =>
    (QUORUM_DIMENSIONS.find((d) => d.key === k)?.label ?? k).toLowerCase();
  const jLead = dimensionLeader["judgement"];
  for (const stakeDim of ["money", "consequence", "effort"]) {
    const sLead = dimensionLeader[stakeDim];
    if (sLead && jLead && sLead !== jLead) {
      tensions.push({
        text: `The person carrying the ${label(stakeDim)} isn't the one the room trusts most on judgement — worth a word before this blooms.`,
      });
      break;
    }
  }

  return {
    people: peopleIds,
    weights,
    dimensionPies,
    dimensionLeader,
    hardcodedBy,
    carriesId,
    gaps,
    tensions,
  };
}
