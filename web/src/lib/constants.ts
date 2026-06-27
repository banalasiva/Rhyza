// Product constants. Where the prototype hardcoded these in JSX, they now live
// in one place — and the reaction/recognition registries live in the database
// (see prisma/seed.ts) so they can be extended without a deploy.

// The five dimensions of understanding a seed accumulates.
export const DIMENSIONS = [
  {
    key: "foundations",
    emoji: "🧠",
    label: "Foundations",
    blurb: "Why does this exist?",
    color: "#EC407A",
    description: "Explore the core idea — what it is, why it exists, what assumptions it makes.",
  },
  {
    key: "understanding",
    emoji: "💡",
    label: "Understanding",
    blurb: "How do I think about it?",
    color: "#FFB300",
    description: "Share the mental models and analogies that make this click.",
  },
  {
    key: "application",
    emoji: "🛠",
    label: "Application",
    blurb: "How is it used in practice?",
    color: "#42A5F5",
    description: "Ground it in practice — real implementations, patterns, war stories.",
  },
  {
    key: "debate",
    emoji: "⚖",
    label: "Debate",
    blurb: "Where does it break down?",
    color: "#AB47BC",
    description: "Pressure-test the idea — edge cases, trade-offs, counter-arguments.",
  },
  {
    key: "bloom",
    emoji: "🌸",
    label: "Bloom",
    blurb: "The distilled answer.",
    color: "#FFB300",
    description: "Distill what the community has converged on into durable knowledge.",
  },
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

// A seed blooms when the number of "bloomed" votes reaches the target: at least
// BLOOM_MIN_VOTERS, or half of the participants — whichever is higher.
export const BLOOM_VOTE_THRESHOLD_PCT = 50;
export const BLOOM_MIN_VOTERS = 2;

// How many "bloomed" votes a seed needs given how many people are participating.
// e.g. 1–4 participants → 2 votes; 5–6 → 3; 7–8 → 4; …
export function bloomTargetFor(participants: number): number {
  return Math.max(
    BLOOM_MIN_VOTERS,
    Math.ceil(participants * (BLOOM_VOTE_THRESHOLD_PCT / 100)),
  );
}
