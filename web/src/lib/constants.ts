// Product constants. Where the prototype hardcoded these in JSX, they now live
// in one place — and the reaction/recognition registries live in the database
// (see prisma/seed.ts) so they can be extended without a deploy.

// The five dimensions of understanding a seed accumulates.
export const DIMENSIONS = [
  {
    key: "foundations",
    emoji: "🧠",
    label: "Foundations",
    blurb: "Why does it exist?",
    color: "#EC407A",
    description: "Explore the core idea — what it is, why it exists, what assumptions it makes.",
  },
  {
    key: "understanding",
    emoji: "💡",
    label: "Understanding",
    blurb: "How should we think about it?",
    color: "#FFB300",
    description: "Share the mental models and analogies that make this click.",
  },
  {
    key: "application",
    emoji: "🛠",
    label: "Application",
    blurb: "How does it work in practice?",
    color: "#42A5F5",
    description: "Ground it in practice — real implementations, patterns, war stories.",
  },
  {
    key: "debate",
    emoji: "⚖",
    label: "Debate",
    blurb: "What are the trade-offs?",
    color: "#AB47BC",
    description: "Pressure-test the idea — edge cases, trade-offs, counter-arguments.",
  },
  {
    key: "bloom",
    emoji: "🌸",
    label: "Bloom",
    blurb: "The community's best understanding.",
    color: "#FFB300",
    description: "Distill what the community has converged on into durable knowledge.",
  },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as DimensionKey[];

// ─────────────────────────────────────────────────────────────
// Stake dimensions — what a person *carries* when a seed is decided.
// Distinct from the five DIMENSIONS above (which describe the conversation).
// The group peer-assesses each person across these; the result weights their
// bloom vote. "kind" is a display hint only — money is fungible (anyone can
// bring the same), the rest are embodied (can't be transferred). We never bake
// that into the math; the group's allocation expresses it on its own.
// ─────────────────────────────────────────────────────────────
export const STAKE_DIMENSIONS = [
  { key: "time", emoji: "⏳", label: "Time", blurb: "Hours and presence", color: "#42A5F5", kind: "embodied" },
  { key: "energy", emoji: "⚡", label: "Energy", blurb: "Effort and drive", color: "#FFA726", kind: "embodied" },
  { key: "focus", emoji: "🎯", label: "Focus", blurb: "Attention it demands", color: "#AB47BC", kind: "embodied" },
  { key: "emotions", emoji: "❤️", label: "Emotions", blurb: "Heart on the line", color: "#EC407A", kind: "embodied" },
  { key: "judgement", emoji: "🧭", label: "Judgement", blurb: "Reading what's right", color: "#26A69A", kind: "embodied" },
  { key: "capability", emoji: "🛠", label: "Capability", blurb: "Skill to pull it off", color: "#5C6BC0", kind: "embodied" },
  { key: "money", emoji: "💰", label: "Money", blurb: "Capital at risk", color: "#66BB6A", kind: "fungible" },
] as const;

export type StakeDimensionKey = (typeof STAKE_DIMENSIONS)[number]["key"];
export const STAKE_DIMENSION_KEYS = STAKE_DIMENSIONS.map((d) => d.key) as StakeDimensionKey[];

// ─────────────────────────────────────────────────────────────
// Quorum v2 — the six dimensions people weigh in on. Each is one comparative
// question; everyone ranks everyone (themselves included) by dragging the people
// who most embody it to the top. `measurable` dims can be hardcoded by an admin
// from a ground truth (e.g. equity %). `self` = "you know your own" (consequence
// stake); the rest are read by the room. All are mandatory.
// ─────────────────────────────────────────────────────────────
export const QUORUM_DIMENSIONS = [
  { key: "money", emoji: "💰", label: "Money", question: "Whose money is most on the line?", color: "#66BB6A", measurable: true },
  { key: "effort", emoji: "⏳", label: "Time & Energy", question: "Who's doing the most of the actual work?", color: "#42A5F5", measurable: false },
  { key: "emotions", emoji: "❤️", label: "Emotions", question: "Who's most emotionally invested in this?", color: "#EC407A", measurable: false },
  { key: "judgement", emoji: "🧭", label: "Judgement", question: "Whose judgement do you trust most for this call?", color: "#26A69A", measurable: false },
  { key: "capability", emoji: "🛠", label: "Capability", question: "Who's most proven to pull this off?", color: "#5C6BC0", measurable: false },
  { key: "consequence", emoji: "⚖️", label: "Consequence", question: "Who has to live with the outcome the most?", color: "#FFA726", measurable: true },
] as const;

export type QuorumDimensionKey = (typeof QUORUM_DIMENSIONS)[number]["key"];
export const QUORUM_DIMENSION_KEYS = QUORUM_DIMENSIONS.map((d) => d.key) as QuorumDimensionKey[];
export const QUORUM_MAX_RANK = 10; // a rater can place at most this many people per dimension

// A seed blooms (when its stake board is in use) once this share of the total
// *stake* has voted to bloom — not this share of heads. A small headcount floor
// (BLOOM_MIN_VOTERS) still applies so a single person can't bloom in silence.
export const STAKE_BLOOM_THRESHOLD_PCT = 50;

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
