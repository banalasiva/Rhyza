import { deriveFingerprint, type DimSlice } from "@/lib/fingerprint";

// A person's thinking fingerprint: the archetype they read as ("Application
// thinker"), a one-line blurb, a unique multi-colour "signature" bar of their
// dimension mix, and a compact legend. Pure render from ranked dimension slices.
export function ThinkingFingerprint({
  dims,
  self,
}: {
  dims: DimSlice[];
  self?: boolean; // "You're a…" vs "They're a…"
}) {
  const fp = deriveFingerprint(dims);
  if (!fp) {
    return self ? (
      <p className="text-xs text-ink-soft">
        Your fingerprint takes shape as you contribute — foundations, understanding, application,
        debate, and where you land.
      </p>
    ) : null;
  }

  const { primary, secondary, slices } = fp;
  const who = self ? "You're" : "They're";

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden style={{ color: primary.color }}>
          {primary.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {who} {aOrAn(primary.tag)} <span style={{ color: primary.color }}>{primary.tag}</span>
          </p>
          {secondary && (
            <p className="text-[11px] text-ink-soft">
              with a {secondary.tag.replace(/^The /, "")}&apos;s streak
            </p>
          )}
        </div>
      </div>

      {primary.blurb && <p className="mt-2 text-xs leading-relaxed text-ink-mid">{primary.blurb}</p>}

      {/* Signature bar — the mix, in one glance, unique to them. */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        {slices.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${s.pct}%`}
            style={{ width: `${s.pct}%`, background: s.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>

      {/* Legend — each present dimension with its share. */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {slices.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.emoji} {s.label} <span className="text-ink-mid">{s.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
