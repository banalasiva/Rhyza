// The "thinking fingerprint" — turns a person's dimension mix (how their
// contributions spread across Foundations / Understanding / Application / Debate
// / Bloom) into an identity: an archetype they can recognise themselves in
// ("I'm an Application thinker"), plus a signature they can see is uniquely
// theirs. Pure + deterministic — no AI, no storage; derived from what they do.

export type DimSlice = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  count: number;
  pct: number;
};

// The identity that each dominant dimension confers. Tags keep the dimension
// name so the phrasing people naturally use ("I'm an Application thinker",
// "I always end up in Debate") is right there.
const ARCHETYPE: Record<string, { tag: string; blurb: string }> = {
  foundations: {
    tag: "Foundations thinker",
    blurb: "You start with why — the assumptions everyone else skips past.",
  },
  understanding: {
    tag: "Understanding thinker",
    blurb: "You build the mental models that make things finally click.",
  },
  application: {
    tag: "Application thinker",
    blurb: "You turn ideas into what to actually do.",
  },
  debate: {
    tag: "The Debater",
    blurb: "You stress-test ideas and surface the trade-offs others miss.",
  },
  bloom: {
    tag: "The Closer",
    blurb: "You bring things to a clear, shared conclusion.",
  },
};

export type Fingerprint = {
  slices: DimSlice[]; // all present dimensions, ranked (for the signature bar)
  primary: DimSlice & { tag: string; blurb: string };
  secondary?: DimSlice & { tag: string }; // a strong runner-up, if there is one
};

// Build the fingerprint from ranked dimension slices (highest pct first, only
// dimensions with real activity). Returns null when there's nothing to show yet.
export function deriveFingerprint(dims: DimSlice[]): Fingerprint | null {
  const slices = dims.filter((d) => d.count > 0);
  if (slices.length === 0) return null;

  const top = slices[0];
  const a = ARCHETYPE[top.key] ?? { tag: `${top.label} thinker`, blurb: "" };
  const primary = { ...top, tag: a.tag, blurb: a.blurb };

  // A runner-up counts as "secondary" only if it's genuinely substantial — at
  // least 20% of activity and close-ish to the top — so it's an identity, not noise.
  const runner = slices[1];
  const secondary =
    runner && runner.pct >= 20 && runner.pct >= top.pct - 25
      ? { ...runner, tag: (ARCHETYPE[runner.key]?.tag ?? `${runner.label} thinker`) }
      : undefined;

  return { slices, primary, secondary };
}
