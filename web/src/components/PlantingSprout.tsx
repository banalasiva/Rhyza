"use client";

import { useEffect, useMemo } from "react";
import { playNatureSound } from "@/lib/sound";

// The planting moment — a full-screen germination that plays WHILE the seed is
// being created (it is the loader), then drops you into the thread. A seed
// falls, a stem springs from the soil, leaves unfurl, a sparkle pops — all over
// a constant, gentle shower of leaves and light, so it feels as alive as the
// bloom. Growth-green, so it stays its own thing next to the bloom's gold.
export function PlantingSprout() {
  // Falling leaves — the constant shower.
  const leaves = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => ({
        key: i,
        left: Math.round(Math.random() * 100),
        w: 9 + Math.round(Math.random() * 12),
        delay: Math.random() * 2.6,
        dur: 3.6 + Math.random() * 2.8,
        drift: `${(Math.random() * 180 - 90).toFixed(0)}px`,
        spin: `${Math.round(Math.random() * 500 - 250)}deg`,
        rot: Math.round(Math.random() * 360),
      })),
    [],
  );

  // A few sparkles that pop around the sprout as it finishes.
  const sparks = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const dist = 70 + Math.random() * 60;
        return {
          key: i,
          size: 6 + Math.round(Math.random() * 8),
          sx: `${Math.round(Math.cos(a) * dist)}px`,
          sy: `${Math.round(Math.sin(a) * dist)}px`,
          delay: 0.95 + Math.random() * 0.3,
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
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden animate-[fadeUp_0.3s_ease-out]"
      style={{ background: "radial-gradient(circle at 50% 52%, #0f2012 0%, #050b06 74%)" }}
    >
      {/* big soft glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[120vw] w-[120vw] max-h-[900px] max-w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(76,175,80,0.28), rgba(76,175,80,0.08) 46%, transparent 70%)",
          animation: "haloBreathe 3.6s ease-in-out infinite",
        }}
      />

      {/* constant leaf shower */}
      <div className="pointer-events-none absolute inset-0">
        {leaves.map((l) => (
          <span
            key={l.key}
            className="leaf-fall"
            style={
              {
                left: `${l.left}%`,
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.dur}s`,
                ["--drift" as string]: l.drift,
                ["--spin" as string]: l.spin,
              } as React.CSSProperties
            }
          >
            <span
              className="leaf-shape"
              style={{ width: l.w, height: Math.round(l.w * 1.35), transform: `rotate(${l.rot}deg)` }}
            />
          </span>
        ))}
      </div>

      <div className="relative">
        {/* The sprout — big enough to fill the screen. */}
        <svg
          viewBox="0 0 200 200"
          className="h-[54vh] max-h-[520px] w-auto max-w-[92vw]"
          role="img"
          aria-label="Planting"
        >
          {/* soil */}
          <ellipse cx="100" cy="150" rx="52" ry="14" fill="#231910" opacity="0.95" />
          <ellipse cx="100" cy="147" rx="34" ry="8" fill="#2f2314" />
          {/* seed dropping in */}
          <ellipse className="sprout-seed" cx="100" cy="147" rx="6.5" ry="4.5" fill="#caa66e" />
          {/* stem */}
          <path
            className="sprout-stem"
            d="M100 149 C 99 126 101 104 100 80"
            stroke="#5fb765"
            strokeWidth="5.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* lower leaf pair (unfurl first) */}
          <g transform="translate(100 120) rotate(-24) scale(-1,1)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.42s" }}
              d="M0 0 C 12 -13 34 -9 47 2 C 33 14 9 12 0 0 Z"
              fill="#4fae57"
            />
          </g>
          <g transform="translate(100 116) rotate(-24)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.5s" }}
              d="M0 0 C 12 -13 34 -9 47 2 C 33 14 9 12 0 0 Z"
              fill="#63c86d"
            />
          </g>
          {/* upper leaf pair */}
          <g transform="translate(100 92) rotate(-32) scale(-1,1)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.66s" }}
              d="M0 0 C 13 -14 36 -10 50 2 C 35 15 10 13 0 0 Z"
              fill="#54b45b"
            />
          </g>
          <g transform="translate(100 86) rotate(-32)">
            <path
              className="sprout-leaf"
              style={{ animationDelay: "0.76s" }}
              d="M0 0 C 13 -14 36 -10 50 2 C 35 15 10 13 0 0 Z"
              fill="#6cce74"
            />
          </g>
          {/* dew tip */}
          <circle className="sprout-tip" cx="100" cy="79" r="4.5" fill="#cbf4ce" />
        </svg>

        {/* sparkle pop around the sprout */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
