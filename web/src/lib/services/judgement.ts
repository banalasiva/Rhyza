import { db } from "@/lib/db";
import { VERDICTS, type Verdict } from "@/lib/services/reckoning";

// ── Judgement / calibration ────────────────────────────────────────────────
// The fourth virtue, made visible as a signal over time. A person's decisions
// are the seeds they LED (created) that bloomed; how each ONE turned out is the
// room's COLLECTIVE reckoning verdict (well / mixed / regret) — shared by
// design, and NOT something the owner can self-declare. So a good calibration
// can't be gamed by always calling the popular position: the reckoning measures
// whether the call turned out right, not whether it was popular.
//
// Cold-start is real: with a handful of decisions the number is noise, so below
// the thresholds we deliberately show a "still forming" state instead of a lie.

// Reckoned decisions needed before we show a headline calibration at all.
const MIN_TO_SHOW = 3;
// Reckoned decisions in a single garden before we break it out as a domain.
const MIN_PER_DOMAIN = 3;

type Tally = { well: number; mixed: number; regret: number };

export type DomainCalibration = {
  garden: string;
  emoji: string;
  well: number;
  mixed: number;
  regret: number;
  total: number; // reckoned decisions in this domain
  landedWell: number; // 0..1 — well ÷ total
};

export type JudgementProfile = {
  reckoned: number; // decisions led + looked back on
  unfolding: number; // led + bloomed, no reckoning verdict yet
  well: number;
  mixed: number;
  regret: number;
  landedWell: number; // 0..1 across all reckoned decisions
  hasEnough: boolean; // reckoned >= MIN_TO_SHOW (else show "still forming")
  domains: DomainCalibration[]; // gardens with >= MIN_PER_DOMAIN, best-first
};

function empty(): JudgementProfile {
  return {
    reckoned: 0,
    unfolding: 0,
    well: 0,
    mixed: 0,
    regret: 0,
    landedWell: 0,
    hasEnough: false,
    domains: [],
  };
}

// The single collective outcome of a decision: the plurality verdict. A tie, or
// a decision the room mostly called "mixed", lands as "mixed" (neither a clean
// right nor wrong call).
function outcomeOf(t: Tally): Verdict {
  if (t.well > t.mixed && t.well > t.regret) return "well";
  if (t.regret > t.well && t.regret > t.mixed) return "regret";
  return "mixed";
}

export async function getJudgementProfile(userId: string): Promise<JudgementProfile> {
  // Decisions this person LED: their seeds whose CURRENT bloom exists (seed
  // .bloomId points at the live bloom — a superseded version isn't reckoned).
  const seeds = await db.seed
    .findMany({
      where: { createdById: userId, deletedAt: null, bloomId: { not: null } },
      select: { bloomId: true },
    })
    .catch(() => [] as { bloomId: string | null }[]);
  const bloomIds = seeds.map((s) => s.bloomId).filter((id): id is string => !!id);
  if (bloomIds.length === 0) return empty();

  const [blooms, reckonings] = await Promise.all([
    db.bloom
      .findMany({
        where: { id: { in: bloomIds } },
        select: { id: true, gardenId: true, garden: { select: { name: true, emoji: true } } },
      })
      .catch(() => [] as { id: string; gardenId: string; garden: { name: string; emoji: string } | null }[]),
    db.bloomReckoning
      .findMany({ where: { bloomId: { in: bloomIds } }, select: { bloomId: true, verdict: true } })
      .catch(() => [] as { bloomId: string; verdict: string }[]),
  ]);
  if (blooms.length === 0) return empty();

  // Fold every reckoner's verdict into a per-decision tally.
  const perBloom = new Map<string, Tally>();
  for (const r of reckonings) {
    if (!(VERDICTS as readonly string[]).includes(r.verdict)) continue;
    const t = perBloom.get(r.bloomId) ?? { well: 0, mixed: 0, regret: 0 };
    t[r.verdict as Verdict]++;
    perBloom.set(r.bloomId, t);
  }

  let well = 0;
  let mixed = 0;
  let regret = 0;
  let unfolding = 0;
  const byGarden = new Map<string, Tally & { name: string; emoji: string }>();

  for (const b of blooms) {
    const t = perBloom.get(b.id);
    if (!t) {
      unfolding++; // led + bloomed, but nobody's looked back yet
      continue;
    }
    const o = outcomeOf(t);
    if (o === "well") well++;
    else if (o === "regret") regret++;
    else mixed++;

    const g =
      byGarden.get(b.gardenId) ??
      { name: b.garden?.name ?? "A garden", emoji: b.garden?.emoji ?? "🌱", well: 0, mixed: 0, regret: 0 };
    g[o]++;
    byGarden.set(b.gardenId, g);
  }

  const reckoned = well + mixed + regret;
  const domains: DomainCalibration[] = [...byGarden.values()]
    .map((g) => {
      const total = g.well + g.mixed + g.regret;
      return {
        garden: g.name,
        emoji: g.emoji,
        well: g.well,
        mixed: g.mixed,
        regret: g.regret,
        total,
        landedWell: total ? g.well / total : 0,
      };
    })
    .filter((d) => d.total >= MIN_PER_DOMAIN)
    .sort((a, b) => b.landedWell - a.landedWell || b.total - a.total);

  return {
    reckoned,
    unfolding,
    well,
    mixed,
    regret,
    landedWell: reckoned ? well / reckoned : 0,
    hasEnough: reckoned >= MIN_TO_SHOW,
    domains,
  };
}
