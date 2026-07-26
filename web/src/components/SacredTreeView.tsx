"use client";

import Link from "next/link";

type Bloom = {
  id: string;
  title: string;
  summary: string;
  version: number;
  contributors: { name: string | null; role: string }[];
};

// Predefined spots along the tree's branches; blooms are placed by index.
const BRANCH = [
  { left: "50%", top: "29%" },
  { left: "66%", top: "41%" },
  { left: "27%", top: "46%" },
  { left: "40%", top: "33%" },
  { left: "60%", top: "57%" },
  { left: "33%", top: "60%" },
  { left: "72%", top: "58%" },
  { left: "50%", top: "48%" },
];

// The Sacred Tree: bloomed decisions hanging on the branches. Tapping a bloom
// opens its full page directly — there's no in-tree preview panel (it hard-coded
// a dark background that turned dark-on-dark in light theme, and on mobile it ate
// the whole width). The full bloom page renders every section, correctly themed.
export function SacredTreeView({ blooms }: { blooms: Bloom[] }) {
  return (
    <div className="relative flex min-h-[78vh] overflow-hidden rounded-2xl border border-[rgba(76,175,80,0.12)]">
      {/* Tree artwork */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/sacred-tree-dark.png')",
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/15 via-transparent to-black/40" />

      {/* Blooms on branches */}
      <div className="relative z-[2] flex-1">
        {blooms.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="rounded-full bg-black/50 px-4 py-2 text-sm text-ink-mid backdrop-blur">
              No blooms yet — grow a seed to its bloom and it lands here.
            </p>
          </div>
        ) : (
          blooms.map((b, i) => {
            const pos = BRANCH[i % BRANCH.length];
            return (
              <Link
                key={b.id}
                href={`/blooms/${b.id}`}
                aria-label={`Open bloom: ${b.title}`}
                className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 active:scale-95"
                style={{ left: pos.left, top: pos.top }}
              >
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: 56, height: 56, background: "radial-gradient(circle,rgba(255,213,79,0.5) 0%,transparent 70%)" }}
                  />
                  <div className="relative" style={{ fontSize: 26, filter: "drop-shadow(0 0 12px rgba(255,213,79,0.8))", lineHeight: 1 }}>
                    🌸
                  </div>
                  <span className="absolute -right-3.5 -top-2.5 rounded-full bg-[rgba(255,179,0,0.95)] px-1.5 py-0.5 text-[11px] font-bold text-[#0A0500]">
                    v{b.version}
                  </span>
                  <span className="absolute -bottom-9 left-1/2 line-clamp-2 w-[150px] -translate-x-1/2 rounded-lg bg-black/60 px-2 py-1 text-center text-[11px] leading-tight text-white/85 backdrop-blur">
                    {b.title}
                  </span>
                </div>
              </Link>
            );
          })
        )}

        <div className="absolute bottom-5 left-1/2 z-[3] -translate-x-1/2 text-center">
          <p className="text-xs italic text-white/35">Tap a 🌸 to open its bloom</p>
        </div>
      </div>
    </div>
  );
}
