// The virtues people recognize each other for — the reputation economy's core.
// Deliberately small and human: these are qualities you're proud to be known
// for, not activity metrics, and none can be farmed (you can't spam your way to
// "good judgement"). Recognition is earned IN CONTEXT on a specific message (the
// evidence) and aggregated on the profile. Kept in sync with the DB via raw
// strings — this file is the runtime source of truth.

export type Virtue = { key: string; emoji: string; label: string; blurb: string };

export const VIRTUES: Virtue[] = [
  { key: "depth", emoji: "🌊", label: "Depth", blurb: "Saw further than the surface" },
  { key: "judgement", emoji: "🎯", label: "Judgement", blurb: "Called it well" },
  { key: "taste", emoji: "🎨", label: "Taste", blurb: "Knew what was worth doing" },
  { key: "empathy", emoji: "🫶", label: "Empathy", blurb: "Understood the people, bridged the gap" },
];

const BY_KEY = new Map(VIRTUES.map((v) => [v.key, v]));

export function isVirtue(key: string): boolean {
  return BY_KEY.has(key);
}

export function virtue(key: string): Virtue | undefined {
  return BY_KEY.get(key);
}
