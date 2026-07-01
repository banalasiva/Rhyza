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
  { key: "money", emoji: "💰", label: "Money", question: "Who is spending or risking the most money?", color: "#66BB6A", measurable: true },
  { key: "effort", emoji: "⏳", label: "Work", question: "Who will do most of the work?", color: "#42A5F5", measurable: false },
  { key: "emotions", emoji: "❤️", label: "Feelings", question: "Who cares about this the most?", color: "#EC407A", measurable: false },
  { key: "judgement", emoji: "🧭", label: "Judgement", question: "Whose opinion do you trust most here?", color: "#26A69A", measurable: false },
  { key: "capability", emoji: "🛠", label: "Skill", question: "Who can do this well?", color: "#5C6BC0", measurable: false },
  { key: "consequence", emoji: "⚖️", label: "Impact", question: "Who will this affect the most?", color: "#FFA726", measurable: true },
] as const;

export type QuorumDimensionKey = (typeof QUORUM_DIMENSIONS)[number]["key"];
export const QUORUM_DIMENSION_KEYS = QUORUM_DIMENSIONS.map((d) => d.key) as QuorumDimensionKey[];
export const QUORUM_MAX_RANK = 10; // a rater can place at most this many people per dimension

// ── Quorum templates ────────────────────────────────────────────────────────
// The same engine (everyone rates everyone → fair aggregate → mirror) serves
// more than decisions. A Quorum has a *purpose*, and each purpose is a curated,
// designed set of dimensions — never free-text, so the framework, the math, and
// the measurable/hardcode logic all stay sound. Owners PICK a template; they
// don't author one.
export type QuorumDimension = {
  key: string;
  emoji: string;
  label: string;
  question: string;
  color: string;
  measurable: boolean;
};

// "Understand together" — for people yearning to learn and get feedback. Every
// dimension is strength-based and a judgement call (none measurable/hardcodable).
export const QUORUM_UNDERSTAND_DIMENSIONS: readonly QuorumDimension[] = [
  { key: "opened_up", emoji: "🔍", label: "Good questions", question: "Whose questions opened up the topic?", color: "#42A5F5", measurable: false },
  { key: "made_click", emoji: "💡", label: "Made it clear", question: "Who explained it so it made sense?", color: "#FFB300", measurable: false },
  { key: "gets_it", emoji: "🧭", label: "Understands best", question: "Who understands it most deeply?", color: "#26A69A", measurable: false },
  { key: "leveling_up", emoji: "🌱", label: "Learning fast", question: "Who is learning the fastest here?", color: "#66BB6A", measurable: false },
  { key: "lifted_others", emoji: "🤝", label: "Helped everyone", question: "Who helped the whole group understand?", color: "#EC407A", measurable: false },
];

export type QuorumTemplateKey = "decide" | "understand";
export const QUORUM_TEMPLATES: Record<
  QuorumTemplateKey,
  { key: QuorumTemplateKey; label: string; emoji: string; blurb: string; dimensions: readonly QuorumDimension[] }
> = {
  decide: {
    key: "decide",
    label: "Decide",
    emoji: "⚖️",
    blurb: "Weigh a real decision — whose stake, judgement and consequence run deepest.",
    dimensions: QUORUM_DIMENSIONS,
  },
  understand: {
    key: "understand",
    label: "Understand together",
    emoji: "🌱",
    blurb: "See how the group learned together — who opened it up, who made it click, who's growing.",
    dimensions: QUORUM_UNDERSTAND_DIMENSIONS,
  },
};

export const QUORUM_TEMPLATE_KEYS = Object.keys(QUORUM_TEMPLATES) as QuorumTemplateKey[];

// Resolve a stored template key to its definition, defaulting to "decide".
export function quorumTemplate(key: string | null | undefined) {
  return QUORUM_TEMPLATES[(key as QuorumTemplateKey)] ?? QUORUM_TEMPLATES.decide;
}

// Every dimension key across all templates — the universe for validation enums.
export const ALL_QUORUM_DIMENSION_KEYS = Array.from(
  new Set(Object.values(QUORUM_TEMPLATES).flatMap((t) => t.dimensions.map((d) => d.key))),
);

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

// ── Explore topics (Phase 2) ───────────────────────────────────────────────
// A small, curated taxonomy for the public square. Public seeds are tagged with
// 1–3 of these (Claude infers them at share time); people choose the same set as
// their interests, and we match the two to personalise Explore + notifications.
// Keys are stable slugs — never rename one without a data migration.
export const EXPLORE_TOPICS = [
  { key: "family", emoji: "👪", label: "Parenting & Family" },
  { key: "relationships", emoji: "❤️", label: "Relationships" },
  { key: "money", emoji: "💰", label: "Money" },
  { key: "career", emoji: "💼", label: "Work & Career" },
  { key: "health", emoji: "🩺", label: "Health" },
  { key: "wellbeing", emoji: "🌱", label: "Wellbeing" },
  { key: "travel", emoji: "✈️", label: "Travel" },
  { key: "food", emoji: "🍳", label: "Food" },
  { key: "home", emoji: "🏡", label: "Home & Living" },
  { key: "learning", emoji: "📚", label: "Learning" },
  { key: "technology", emoji: "💻", label: "Technology" },
  { key: "product", emoji: "🛠", label: "Product & Startups" },
  { key: "creativity", emoji: "🎨", label: "Creativity" },
  { key: "community", emoji: "🤝", label: "Community & Society" },
] as const;

export type TopicKey = (typeof EXPLORE_TOPICS)[number]["key"];
export const TOPIC_KEYS = EXPLORE_TOPICS.map((t) => t.key) as TopicKey[];
const TOPIC_BY_KEY = new Map(EXPLORE_TOPICS.map((t) => [t.key, t]));

export function topicMeta(key: string) {
  return TOPIC_BY_KEY.get(key as TopicKey) ?? null;
}

export function topicLabel(key: string): string {
  const t = topicMeta(key);
  return t ? `${t.emoji} ${t.label}` : key;
}

// Keep only valid topic keys, de-duplicated, capped — used to sanitise both
// Claude's inferred tags and a user's chosen interests.
export function sanitizeTopics(keys: string[], cap = 5): TopicKey[] {
  const seen = new Set<TopicKey>();
  for (const k of keys) {
    const key = String(k).trim().toLowerCase();
    if (TOPIC_BY_KEY.has(key as TopicKey)) seen.add(key as TopicKey);
    if (seen.size >= cap) break;
  }
  return [...seen];
}

// The daily "good morning" message library lives in ./daily-messages. Re-export
// the picker here so existing imports keep working.
export { messageOfTheDay, DAILY_MESSAGES, type DailyMessage } from "@/lib/daily-messages";
