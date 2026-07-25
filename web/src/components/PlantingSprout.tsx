"use client";

import { useEffect, useMemo } from "react";
import { playNatureSound } from "@/lib/sound";

// The planting moment — shown the instant you tap plant, it plays WHILE the seed
// is being created (it is the loader), then you land in the thread. No words:
// a seed drops, a stem springs up, two leaves unfurl, a little sparkle pops.
// Deliberately quieter than the bloom — hope, not triumph.
export function PlantingSprout() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const dist = 44 + Math.random() * 26;
        return {
          key: i,
          size: 5 + Math.round(Math.random() * 6),
          sx: `${Math.round(Math.cos(a) * dist)}px`,
          sy: `${Math.round(Math.sin(a) * dist)}px`,
          delay: 0.9 + Math.random() * 0.18,
        };
      }),
    [],
  );

  useEffect(() => {
    try {
      playNatureSound("drop");
    } catch {
      /* best-effort */
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden animate-[fadeUp_0.25s_ease-out]"
      style={{ background: "radial-gradient(circle at 50% 50%, #0d1a0f 0%, #050b06 72%)" }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="sprout-glow" />
      </div>

      <div className="relative">
        <svg viewBox="0 0 200 200" className="h-56 w-56" role="img" aria-label="Planting">
          <ellipse cx="100" cy="150" rx="48" ry="13" fill="#231910" opacity="0.95" />
          <ellipse cx="100" cy="147" rx="30" ry="7" fill="#2f2314" />
          <ellipse className="sprout-seed" cx="100" cy="147" rx="6.5" ry="4.5" fill="#caa66e" />
          <path
            className="sprout-stem"
            d="M100 149 C 99 128 101 108 100 88"
            stroke="#5fb765"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <g transform="translate(100 100) rotate(-30) scale(-1,1)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.5s" }}
              d="M0 0 C 12 -13 34 -9 47 2 C 33 14 9 12 0 0 Z"
              fill="#54b45b"
            />
          </g>
          <g transform="translate(100 94) rotate(-30)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.62s" }}
              d="M0 0 C 12 -13 34 -9 47 2 C 33 14 9 12 0 0 Z"
              fill="#6cce74"
            />
          </g>
          <circle className="sprout-tip" cx="100" cy="87" r="4" fill="#cbf4ce" />
        </svg>

        {/* sparkle pop around the sprout */}
        <div className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
          {sparks.map((s) => (
            <span
              key={s.key}
              className="sprout-spark"
              style={
                {
                  width: s.size,
                  height: s.size,
                  animationDelay: `${s.delay}s`,
                  ["--sx" as string]: s.sx,
                  ["--sy" as string]: s.sy,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
