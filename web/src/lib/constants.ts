// Product constants. Where the prototype hardcoded these in JSX, they now live
// in one place — and the reaction/recognition registries live in the database
// (see prisma/seed.ts) so they can be extended without a deploy.

// The five dimensions of understanding a seed accumulates.
export const DIMENSIONS = [
  { key: "foundations", emoji: "🧠", label: "Foundations", blurb: "Why does this exist?" },
  { key: "understanding", emoji: "💡", label: "Understanding", blurb: "How do I think about it?" },
  { key: "application", emoji: "🛠", label: "Application", blurb: "How is it used in practice?" },
  { key: "debate", emoji: "⚖", label: "Debate", blurb: "Where does it break down?" },
  { key: "bloom", emoji: "🌸", label: "Bloom", blurb: "The distilled answer." },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as DimensionKey[];

// Seed growth stages, in order.
export const STAGES = [
  { key: "seed", emoji: "🌱", label: "Seed" },
  { key: "germinating", emoji: "💧", label: "Germinating" },
  { key: "sprouting", emoji: "🌿", label: "Sprouting" },
  { key: "growing", emoji: "🌳", label: "Growing" },
  { key: "bloomed", emoji: "🌸", label: "Bloomed" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as StageKey[];

export function stageIndex(stage: string): number {
  const i = STAGE_KEYS.indexOf(stage as StageKey);
  return i === -1 ? 0 : i;
}

// A seed blooms when at least this share of stage votes land on "bloomed",
// with a minimum number of voters so a single early vote can't trigger it.
export const BLOOM_VOTE_THRESHOLD_PCT = 60;
export const BLOOM_MIN_VOTERS = 3;
