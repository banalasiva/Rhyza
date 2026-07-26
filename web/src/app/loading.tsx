// Global route loader — a small golden bud, gently breathing. Lightweight and
// on-brand with the planting family (no heavy sprite, no ring, no roots), so a
// page load reads as "growing" and never as a slow, full-screen takeover.
export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="garden-bg" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <svg className="bud-loader h-24 w-24" viewBox="0 0 100 100" role="img" aria-label="Loading">
          <defs>
            <linearGradient id="budLoaderStem" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#5cae63" />
              <stop offset="100%" stopColor="#8fd88a" />
            </linearGradient>
            <radialGradient id="budLoaderBud" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fff2c8" />
              <stop offset="50%" stopColor="#f5c451" />
              <stop offset="100%" stopColor="#d99a2b" />
            </radialGradient>
            <radialGradient id="budLoaderGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#f5c451" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="44" r="20" fill="url(#budLoaderGlow)" />
          <path
            d="M50 74 C 49 64 51 56 50 48"
            stroke="url(#budLoaderStem)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M50 62 C 38 58 28 62 24 70 C 33 75 45 71 50 62 Z" fill="#6cce74" />
          <path d="M50 62 C 62 58 72 62 76 70 C 67 75 55 71 50 62 Z" fill="#8fd88a" />
          <path
            d="M50 54 C 44 54 42 47.5 43.5 42.5 C 45 38 50 36 50 36 C 50 36 55 38 56.5 42.5 C 58 47.5 56 54 50 54 Z"
            fill="url(#budLoaderBud)"
          />
          <circle cx="50" cy="43" r="2.2" fill="#fff6dc" />
        </svg>
        <p className="text-xs text-ink-soft">Loading…</p>
      </div>
    </div>
  );
}
