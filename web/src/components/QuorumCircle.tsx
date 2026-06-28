"use client";

import { useState } from "react";

// The Quorum banner: "everyone who carries this comes together." Prefers the
// uploaded photo at /public/quorum-circle.png; if that's missing it falls back
// to the animated SVG below, so the tab is never broken.
export function QuorumCircle() {
  const [imgOk, setImgOk] = useState(true);
  if (!imgOk) return <QuorumArt />;
  return (
    <div
      role="img"
      aria-label="People and animals gathered in a circle around a glowing light at dusk — coming together to decide."
      className="relative mb-4 overflow-hidden rounded-2xl border border-[rgba(255,179,0,0.18)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/quorum-circle.png"
        alt=""
        onError={() => setImgOk(false)}
        className="h-44 w-full object-cover sm:h-52"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[rgba(8,13,8,0.85)] to-transparent" />
      <p className="absolute bottom-3 left-4 text-[12px] font-medium tracking-wide text-[rgba(255,235,190,0.95)]">
        ⚖️ Everyone who carries this comes together
      </p>
    </div>
  );
}

// Animated SVG fallback — a circle of figures around a turning sun-mandala.
const FIGURES = Array.from({ length: 13 });

function Figure({ i, total }: { i: number; total: number }) {
  // Fan the figures along a shallow arc so they read as a circle seen head-on.
  const t = total > 1 ? i / (total - 1) : 0.5;
  const x = 6 + t * 88; // % across
  const dip = Math.sin(t * Math.PI) * 10; // center figures sit a touch lower
  const h = 30 + Math.sin(t * Math.PI) * 8;
  return (
    <div
      className="quorum-bob absolute bottom-0"
      style={{ left: `${x}%`, transform: "translateX(-50%)", animationDelay: `${(i % 5) * 0.4}s`, marginBottom: dip }}
    >
      <svg width={16} height={h} viewBox="0 0 16 44" fill="none">
        {/* warm backlit rim + dark silhouette */}
        <circle cx="8" cy="8" r="4.2" fill="#14100a" stroke="rgba(255,200,120,0.45)" strokeWidth="1" />
        <path
          d="M2 44c0-9 1.5-15 6-17 4.5 2 6 8 6 17z"
          fill="#14100a"
          stroke="rgba(255,200,120,0.4)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function QuorumArt() {
  return (
    <div
      role="img"
      aria-label="People gathered in a circle around a glowing sun at dusk — coming together to decide."
      className="relative mb-4 h-36 w-full overflow-hidden rounded-2xl border border-[rgba(255,179,0,0.18)]"
    >
      {/* sky / sunset */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 38%, rgba(255,205,110,0.42), rgba(255,140,0,0.14) 38%, rgba(8,13,8,0) 66%), linear-gradient(to bottom, rgba(30,22,10,0.35), rgba(8,13,8,0.92))",
        }}
      />

      {/* mandala — concentric rings + spokes, slowly turning */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          className="quorum-spin"
          style={{ opacity: 0.5 }}
        >
          <g stroke="rgba(255,200,110,0.5)" strokeWidth="0.6" fill="none">
            {[28, 46, 66, 86].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} />
            ))}
            {Array.from({ length: 24 }).map((_, k) => {
              const a = (k / 24) * Math.PI * 2;
              return (
                <line
                  key={k}
                  x1={100 + Math.cos(a) * 28}
                  y1={100 + Math.sin(a) * 28}
                  x2={100 + Math.cos(a) * 86}
                  y2={100 + Math.sin(a) * 86}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* sun glow */}
      <div
        className="quorum-pulse absolute left-1/2 top-[46%]"
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,228,150,0.95), rgba(255,179,0,0.25) 58%, transparent 72%)",
        }}
      />

      {/* drifting birds */}
      {[{ top: "18%", left: "28%", d: "0s" }, { top: "26%", left: "60%", d: "3s" }, { top: "14%", left: "72%", d: "6s" }].map(
        (b, i) => (
          <svg
            key={i}
            className="quorum-bird absolute"
            style={{ top: b.top, left: b.left, animationDelay: b.d }}
            width={16}
            height={8}
            viewBox="0 0 16 8"
            fill="none"
          >
            <path d="M1 5c2.5-3 4-3 7 0 3-3 4.5-3 7 0" stroke="rgba(40,30,15,0.7)" strokeWidth="1" strokeLinecap="round" />
          </svg>
        ),
      )}

      {/* the circle of stakeholders */}
      <div className="absolute inset-x-0 bottom-0 h-20">
        {FIGURES.map((_, i) => (
          <Figure key={i} i={i} total={FIGURES.length} />
        ))}
      </div>

      {/* caption */}
      <p className="absolute left-4 top-3 text-[11px] font-medium tracking-wide text-[rgba(255,230,180,0.9)]">
        ⚖️ Everyone who carries this stands in the circle
      </p>
    </div>
  );
}
