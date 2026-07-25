"use client";

import { useEffect, useMemo, useState } from "react";
import { playNatureSound } from "@/lib/sound";

// The planting moment — the emotional bookend to the bloom. When you plant a
// seed, a stem grows from the soil and two leaves unfurl, with a hopeful line:
// your question is in the ground and already has life in it (Claude is opening
// it as this plays). Deliberately gentler and shorter than the bloom so the
// bloom stays the peak of the arc. Auto-eases away; tap anywhere to skip.
export function SproutCelebration({ title, onDone }: { title: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  const motes = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        left: 12 + Math.round(Math.random() * 76),
        size: 5 + Math.round(Math.random() * 7),
        delay: 0.3 + Math.random() * 2.4,
        dur: 3.8 + Math.random() * 2.4,
        drift: `${(Math.random() * 120 - 60).toFixed(0)}px`,
        rise: `-${(30 + Math.random() * 22).toFixed(0)}vh`,
        key: i,
      })),
    [],
  );

  function finish() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 420); // let the fade-out play
  }

  useEffect(() => {
    // A soft "drop" as the seed lands.
    try {
      playNatureSound("drop");
    } catch {
      /* sound is best-effort */
    }
    // Ease away on its own after the sprout has settled.
    const t = setTimeout(finish, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      aria-label="Continue"
      onClick={finish}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden px-6 text-center transition-opacity duration-400"
      style={{
        background: "radial-gradient(circle at 50% 46%, #0d1a0f 0%, #050b06 70%)",
        opacity: leaving ? 0 : 1,
      }}
    >
      {/* soft green glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="sprout-glow" />
      </div>

      {/* slow rising motes */}
      <div className="pointer-events-none absolute inset-0">
        {motes.map((m) => (
          <span
            key={m.key}
            className="sprout-mote"
            style={
              {
                left: `${m.left}%`,
                width: m.size,
                height: m.size,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.dur}s`,
                ["--drift" as string]: m.drift,
                ["--rise" as string]: m.rise,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative animate-[fadeUp_0.7s_ease-out]">
        {/* The sprout */}
        <svg viewBox="0 0 200 200" className="mx-auto mb-1 h-44 w-44" role="img" aria-label="A sprout">
          {/* soil */}
          <ellipse cx="100" cy="150" rx="48" ry="13" fill="#231910" opacity="0.95" />
          <ellipse cx="100" cy="147" rx="30" ry="7" fill="#2f2314" />
          {/* seed dropping in */}
          <ellipse className="sprout-seed" cx="100" cy="147" rx="6.5" ry="4.5" fill="#caa66e" />
          {/* stem */}
          <path
            className="sprout-stem"
            d="M100 149 C 99 128 101 108 100 88"
            stroke="#5fb765"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          {/* left leaf (mirrored) */}
          <g transform="translate(100 100) rotate(-30) scale(-1,1)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.95s" }}
              d="M0 0 C 12 -13 34 -9 47 2 C 33 14 9 12 0 0 Z"
              fill="#54b45b"
            />
          </g>
          {/* right leaf */}
          <g transform="translate(100 94) rotate(-30)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "1.1s" }}
              d="M0 0 C 12 -13 34 -9 47 2 C 33 14 9 12 0 0 Z"
              fill="#6cce74"
            />
          </g>
          {/* dew tip */}
          <circle className="sprout-tip" cx="100" cy="87" r="4" fill="#cbf4ce" />
        </svg>

        <p className="eyebrow mb-2 text-accent">🌱 Planted</p>
        <h2 className="serif-lg mx-auto max-w-md text-ink">{title}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink-mid">
          It’s in the ground. Claude’s already thinking it through — bring your people in and watch
          it grow. 🌱
        </p>
        <span className="mt-5 inline-block text-xs text-ink-soft">tap to continue</span>
      </div>
    </button>
  );
}
