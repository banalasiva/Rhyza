"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { playNatureSound } from "@/lib/sound";

// The planting moment — a full-screen germination that plays WHILE the seed is
// being created (it is the loader), then lands you in the thread. It grows the
// way a real seed does: the seed rests in the soil, a germination spark fires at
// the ground, the sprout RISES, two leaves unfurl, and the bud forms and glows.
// Everything moves up from the earth — nothing drops from the sky.
//
// Rendered through a PORTAL to <body> so no transformed/positioned ancestor (it
// lives inside the fixed bottom nav) can clip it — it always fills the viewport.
// Theme-aware ground: warm-espresso spotlight in dark mode, clean white in light.
export function PlantingSprout() {
  const [mounted, setMounted] = useState(false);

  // Ambient sparkles drifting up across the lower half of the screen.
  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        key: i,
        size: 2 + Math.round(Math.random() * 4),
        left: 16 + Math.round(Math.random() * 68),
        top: 34 + Math.round(Math.random() * 44),
        dur: 2.6 + Math.random() * 2.2,
        delay: 0.8 + Math.random() * 2.6,
        peak: (0.4 + Math.random() * 0.5).toFixed(2),
      })),
    [],
  );

  useEffect(() => {
    setMounted(true);
    try {
      playNatureSound("drop");
    } catch {
      /* best-effort */
    }
  }, []);

  if (!mounted) return null;

  const scene = (
    <div className="plant-stage fixed inset-0 z-[300] flex items-center justify-center overflow-hidden animate-[fadeUp_0.3s_ease-out]">
      {/* Ambient halo that swells as the bud glows. */}
      <div className="plant-halo pointer-events-none absolute left-1/2 top-[46%] h-[120vw] w-[120vw] max-h-[820px] max-w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      {/* Ambient sparkles. */}
      <div className="pointer-events-none absolute inset-0">
        {sparkles.map((s) => (
          <span
            key={s.key}
            className="plant-sparkle"
            style={
              {
                width: s.size,
                height: s.size,
                left: `${s.left}%`,
                top: `${s.top}%`,
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
                ["--peak" as string]: s.peak,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* seed in soil → germinates → sprouts up → bud glows */}
      <svg
        viewBox="0 0 200 200"
        className="h-auto w-[66vw] max-w-[360px]"
        role="img"
        aria-label="Planting a seed"
      >
        <defs>
          <radialGradient id="plantSparkG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#ffe08a" />
            <stop offset="70%" stopColor="#f5c451" />
            <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="plantStemG" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#5cae63" />
            <stop offset="100%" stopColor="#8fd88a" />
          </linearGradient>
          <radialGradient id="plantBudG" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff2c8" />
            <stop offset="50%" stopColor="#f5c451" />
            <stop offset="100%" stopColor="#d99a2b" />
          </radialGradient>
          <radialGradient id="plantGlowG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.95" />
            <stop offset="42%" stopColor="#f5c451" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* the soil the seed is planted in */}
        <ellipse className="plant-soil-1" cx="100" cy="156" rx="50" ry="11" />
        <ellipse className="plant-soil-2" cx="100" cy="153" rx="38" ry="7.5" />

        {/* germination sparks rising from the soil */}
        <g stroke="url(#plantSparkG)" strokeWidth="2" strokeLinecap="round">
          <line className="plant-gspark" x1="100" y1="150" x2="100" y2="132" style={{ animationDelay: "0.30s" }} />
          <line className="plant-gspark" x1="100" y1="150" x2="118" y2="140" style={{ animationDelay: "0.34s" }} />
          <line className="plant-gspark" x1="100" y1="150" x2="82" y2="140" style={{ animationDelay: "0.34s" }} />
        </g>

        {/* the stem rises up out of the soil */}
        <path
          className="plant-stem"
          d="M100 152 C 99 138 101 126 100 112"
          stroke="url(#plantStemG)"
          strokeWidth="4.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* two leaves */}
        <path
          className="plant-leaf plant-leaf-l"
          d="M100 130 C 82 124 66 130 60 142 C 74 150 92 144 100 130 Z"
          fill="#6cce74"
        />
        <path
          className="plant-leaf plant-leaf-r"
          d="M100 130 C 118 124 134 130 140 142 C 126 150 108 144 100 130 Z"
          fill="#8fd88a"
        />

        {/* golden glow centered exactly behind the bud (opacity-only, no drift) */}
        <circle className="plant-bud-glow" cx="100" cy="100" r="25" fill="url(#plantGlowG)" />

        {/* the bud */}
        <g className="plant-bud">
          <path
            d="M100 113 C 93.5 113 91 104.5 93 98 C 94.8 92.8 100 90.5 100 90.5 C 100 90.5 105.2 92.8 107 98 C 109 104.5 106.5 113 100 113 Z"
            fill="url(#plantBudG)"
          />
          <circle cx="100" cy="99" r="3" fill="#fff6dc" />
        </g>

        {/* the seed resting in the soil */}
        <ellipse className="plant-seed" cx="100" cy="150" rx="6.5" ry="8.5" fill="#e7b45a" />
        {/* germination flash at the seed */}
        <circle className="plant-germ" cx="100" cy="149" r="13" fill="url(#plantSparkG)" />
      </svg>
    </div>
  );

  return createPortal(scene, document.body);
}
