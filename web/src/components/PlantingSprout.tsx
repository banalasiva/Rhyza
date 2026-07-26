"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { playNatureSound } from "@/lib/sound";

// The planting moment — a full-screen germination in three beats that plays
// WHILE the seed is being created (it is the loader), then drops you into the
// thread: a seed falls, a golden spark bursts (the seed becomes light), then a
// two-leaf bud unfurls with a warm golden glow, all over a constant shimmer of
// golden sparkles.
//
// Rendered through a PORTAL to <body> so no transformed/positioned ancestor (it
// lives inside the fixed bottom nav) can clip it — it always fills the viewport.
// Theme-aware: a dark ground in dark mode, warm paper in light mode, so the gold
// reads as light either way.
//
// `hold` renders the RESTING end-state (a grown bud, no entrance beats) — used
// by the seed route's loader so the hand-off from this overlay into the page
// load is seamless: one continuous sprout, never a separate "Loading…" screen.
export function PlantingSprout({ hold = false }: { hold?: boolean }) {
  const [mounted, setMounted] = useState(false);

  // Ambient golden sparkles drifting up across the screen.
  const sparkles = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, i) => ({
        key: i,
        size: 2 + Math.round(Math.random() * 5),
        left: 12 + Math.round(Math.random() * 76),
        top: 26 + Math.round(Math.random() * 56),
        dur: 2.6 + Math.random() * 2.4,
        delay: Math.random() * 2.2,
        peak: (0.4 + Math.random() * 0.6).toFixed(2),
      })),
    [],
  );

  // A ring of sparkles fired off by the golden spark.
  const burst = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const dist = 55 + Math.random() * 55;
        return {
          key: i,
          bx: `${Math.round(Math.cos(a) * dist)}px`,
          by: `${Math.round(Math.sin(a) * dist)}px`,
          delay: 0.34 + Math.random() * 0.04,
        };
      }),
    [],
  );

  useEffect(() => {
    setMounted(true);
    if (!hold) {
      try {
        playNatureSound("drop");
      } catch {
        /* best-effort */
      }
    }
  }, [hold]);

  if (!mounted) return null;

  const svgClass = hold ? "plant-hold" : "";

  const scene = (
    <div className="plant-stage fixed inset-0 z-[300] flex items-center justify-center overflow-hidden animate-[fadeUp_0.3s_ease-out]">
      {/* Breathing golden halo behind everything. */}
      <div className="plant-halo pointer-events-none absolute left-1/2 top-1/2 h-[128vw] w-[128vw] max-h-[860px] max-w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      {/* Ambient golden sparkles. */}
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

      <div className="relative flex items-center justify-center">
        {/* seed → golden spark → two-leaf bud */}
        <svg
          viewBox="0 0 200 200"
          className={`h-auto w-[66vw] max-w-[360px] ${svgClass}`}
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
              <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#f5c451" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* rays shooting out of the spark (entrance only) */}
          {!hold && (
            <g stroke="url(#plantSparkG)" strokeWidth="2.5" strokeLinecap="round">
              <line className="plant-ray" x1="100" y1="118" x2="100" y2="72" style={{ animationDelay: "0.32s" }} />
              <line className="plant-ray" x1="100" y1="118" x2="140" y2="90" style={{ animationDelay: "0.34s" }} />
              <line className="plant-ray" x1="100" y1="118" x2="150" y2="122" style={{ animationDelay: "0.36s" }} />
              <line className="plant-ray" x1="100" y1="118" x2="132" y2="152" style={{ animationDelay: "0.38s" }} />
              <line className="plant-ray" x1="100" y1="118" x2="68" y2="152" style={{ animationDelay: "0.38s" }} />
              <line className="plant-ray" x1="100" y1="118" x2="50" y2="122" style={{ animationDelay: "0.36s" }} />
              <line className="plant-ray" x1="100" y1="118" x2="60" y2="90" style={{ animationDelay: "0.34s" }} />
            </g>
          )}

          {/* stem */}
          <path
            className="plant-stem"
            d="M100 150 C 99 132 101 128 100 116"
            stroke="url(#plantStemG)"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* two leaves */}
          <path
            className="plant-leaf plant-leaf-l"
            d="M100 128 C 82 122 66 128 60 140 C 74 148 92 142 100 128 Z"
            fill="#6cce74"
          />
          <path
            className="plant-leaf plant-leaf-r"
            d="M100 128 C 118 122 134 128 140 140 C 126 148 108 142 100 128 Z"
            fill="#8fd88a"
          />

          {/* golden glow pooled behind the bud */}
          <circle className="plant-bud-glow" cx="100" cy="102" r="26" fill="url(#plantGlowG)" />

          {/* the golden bud — small, with a bright tip */}
          <g className="plant-bud">
            <path
              d="M100 113 C 93.5 113 91 104.5 93 98 C 94.8 92.8 100 90.5 100 90.5 C 100 90.5 105.2 92.8 107 98 C 109 104.5 106.5 113 100 113 Z"
              fill="url(#plantBudG)"
            />
            <circle cx="100" cy="99" r="3" fill="#fff6dc" />
          </g>

          {/* the seed + spark core (entrance only) */}
          {!hold && (
            <>
              <ellipse className="plant-seed" cx="100" cy="120" rx="7" ry="9.5" fill="#e7b45a" />
              <circle className="plant-spark" cx="100" cy="118" r="16" fill="url(#plantSparkG)" />
            </>
          )}
        </svg>

        {/* burst sparkles fired from the spark (entrance only) */}
        {!hold && (
          <div className="pointer-events-none absolute left-1/2 top-1/2">
            {burst.map((b) => (
              <span
                key={b.key}
                className="plant-burst"
                style={
                  {
                    animationDelay: `${b.delay}s`,
                    ["--bx" as string]: b.bx,
                    ["--by" as string]: b.by,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(scene, document.body);
}
