// The universal route loader — the resting sprout: a golden bud glowing on the
// same warm spotlight ground as the bloom, with sparkles drifting up. It stands
// in for the old emblem "Loading…" screen everywhere, and lets the planting
// moment hand straight off to the thread as one continuous sprout.
//
// Deliberately server-renderable and DETERMINISTIC (fixed sparkle positions, no
// portal, no randomness) so it paints instantly on first load with no hydration
// mismatch — unlike the interactive PlantingSprout overlay, which portals and
// plays the full entrance.

// Fixed ambient sparkles (no Math.random → SSR-stable).
const SPARKLES = [
  { left: 22, top: 34, size: 4, dur: 3.2, delay: 0.0, peak: 0.8 },
  { left: 70, top: 30, size: 3, dur: 3.8, delay: 0.6, peak: 0.7 },
  { left: 40, top: 60, size: 5, dur: 3.0, delay: 1.1, peak: 0.9 },
  { left: 82, top: 54, size: 3, dur: 4.2, delay: 0.3, peak: 0.6 },
  { left: 30, top: 72, size: 4, dur: 3.6, delay: 1.6, peak: 0.75 },
  { left: 60, top: 40, size: 2, dur: 2.8, delay: 0.9, peak: 0.7 },
  { left: 50, top: 78, size: 4, dur: 3.4, delay: 2.0, peak: 0.85 },
  { left: 16, top: 52, size: 3, dur: 4.0, delay: 1.3, peak: 0.6 },
  { left: 76, top: 70, size: 4, dur: 3.1, delay: 0.4, peak: 0.8 },
  { left: 46, top: 30, size: 2, dur: 3.7, delay: 1.8, peak: 0.65 },
  { left: 88, top: 40, size: 3, dur: 3.3, delay: 1.0, peak: 0.7 },
  { left: 34, top: 46, size: 3, dur: 3.9, delay: 0.2, peak: 0.7 },
];

export function SproutLoader() {
  return (
    <div className="plant-stage fixed inset-0 z-[300] flex items-center justify-center overflow-hidden animate-[fadeUp_0.3s_ease-out]">
      <div className="plant-halo pointer-events-none absolute left-1/2 top-1/2 h-[128vw] w-[128vw] max-h-[860px] max-w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      <div className="pointer-events-none absolute inset-0">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
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

      <svg
        viewBox="0 0 200 200"
        className="plant-hold h-auto w-[66vw] max-w-[360px]"
        role="img"
        aria-label="Loading"
      >
        <defs>
          <linearGradient id="loaderStemG" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#5cae63" />
            <stop offset="100%" stopColor="#8fd88a" />
          </linearGradient>
          <radialGradient id="loaderBudG" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff2c8" />
            <stop offset="50%" stopColor="#f5c451" />
            <stop offset="100%" stopColor="#d99a2b" />
          </radialGradient>
          <radialGradient id="loaderGlowG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#f5c451" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          className="plant-stem"
          d="M100 150 C 99 132 101 128 100 116"
          stroke="url(#loaderStemG)"
          strokeWidth="4.5"
          fill="none"
          strokeLinecap="round"
        />
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
        {/* glow centered exactly behind the bud */}
        <circle className="plant-bud-glow" cx="100" cy="100" r="24" fill="url(#loaderGlowG)" />
        <g className="plant-bud">
          <path
            d="M100 113 C 93.5 113 91 104.5 93 98 C 94.8 92.8 100 90.5 100 90.5 C 100 90.5 105.2 92.8 107 98 C 109 104.5 106.5 113 100 113 Z"
            fill="url(#loaderBudG)"
          />
          <circle cx="100" cy="99" r="3" fill="#fff6dc" />
        </g>
      </svg>
    </div>
  );
}
