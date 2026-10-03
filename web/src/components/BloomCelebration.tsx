"use client";

import { useMemo } from "react";
import { PlantSvg } from "@/components/PlantSvg";

// The "you decided it together" moment: a full-screen celebration when a seed
// blooms. Themed via the .bloom-overlay rules in globals.css — a night scene in
// the dark theme, a sunlit one in the light theme.

export function BloomCelebration({ title, onEnter }: { title: string; onEnter: () => void }) {
  // A big, festive fall: emoji confetti (party poppers, round flowers, balloons,
  // sparkles, stars, ribbons) mixed with soft CSS petals raining down.
  const EMOJI = ["🎉", "🎊", "🎈", "✨", "🌟", "🎀", "🌸", "🌺", "💐", "💫", "🏵️", "🌼"];
  const PETAL = ["#FFC1CC", "#FFD98A", "#FF9FB0", "#FFE0B2"];
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        isEmoji: i % 4 !== 0, // ~75% festive emoji, ~25% soft petals
        char: EMOJI[i % EMOJI.length],
        color: PETAL[i % PETAL.length],
        left: Math.round(Math.random() * 100), // launch from anywhere along the bottom
        delay: Math.random() * 2.6,
        dur: 2.6 + Math.random() * 2.2, // quicker = more energetic
        size: 16 + Math.round(Math.random() * 22),
        drift: `${(Math.random() * 220 - 110).toFixed(0)}px`, // sideways spread as it flies up
        rise: `-${(72 + Math.random() * 34).toFixed(0)}vh`, // how high it shoots
        spin: `${Math.round(Math.random() * 900 - 450)}deg`,
        rot: Math.round(Math.random() * 360),
      })),
    [],
  );
  return (
    <div
      // Fully OPAQUE backdrop — nothing behind bleeds through. The colours come
      // from .bloom-overlay in globals.css so the moment has a night (dark theme)
      // and a daylight (light theme) look instead of one fixed dark scene.
      className="bloom-overlay fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-6 text-center"
    >
      {/* big, warm celebration glow behind the plant */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="celebrate-glow" />
      </div>

      {/* festive burst — party poppers, flowers, confetti + soft petals shooting
          UP from the bottom (energetic), not drifting down. */}
      <div className="pointer-events-none absolute inset-0">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="celebrate-rise"
            style={{
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              ["--drift" as string]: c.drift,
              ["--rise" as string]: c.rise,
              ["--spin" as string]: c.spin,
            } as React.CSSProperties}
          >
            {c.isEmoji ? (
              <span style={{ fontSize: c.size, display: "inline-block", transform: `rotate(${c.rot}deg)` }}>
                {c.char}
              </span>
            ) : (
              <span
                className="petal-shape"
                style={{
                  width: Math.round(c.size * 0.5),
                  height: Math.round(c.size * 0.7),
                  background: `linear-gradient(135deg, ${c.color}, rgba(255,255,255,0.25))`,
                  transform: `rotate(${c.rot}deg)`,
                }}
              />
            )}
          </span>
        ))}
      </div>

      <div className="relative animate-[fadeUp_0.8s_ease-out]">
        {/* The plant — bigger for the celebration, with a soft halo ring around
            it. Its bloom bulb + glow come from PlantSvg; the big warm glow behind
            is celebrate-glow. */}
        <div className="relative mx-auto mb-2 h-56 w-56">
          <span className="bloom-halo-ring" />
          <PlantSvg stage={4} ground="mound" />
        </div>
        <p className="eyebrow bloom-eyebrow mb-2">✨ You decided it together 🌸 ✨</p>
        <h2 className="serif-lg mx-auto max-w-md bloom-shimmer">{title}</h2>
        <p className="mt-3 text-sm text-ink-mid">
          You decided this together — and it’s yours to keep, forever. 🌸
        </p>
        <button onClick={onEnter} className="btn-primary bloom-cta mt-5">
          See where it’s kept →
        </button>
      </div>
    </div>
  );
}
