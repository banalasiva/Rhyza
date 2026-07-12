"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BloomContent } from "@/components/BloomContent";

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

export function SacredTreeView({ blooms }: { blooms: Bloom[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = blooms.find((b) => b.id === selected) ?? null;

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
            const isSel = selected === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(isSel ? null : b.id)}
                className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 transition-transform"
                style={{ left: pos.left, top: pos.top, transform: `translate(-50%,-50%) scale(${isSel ? 1.25 : 1})` }}
              >
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: isSel ? 80 : 56, height: isSel ? 80 : 56, background: "radial-gradient(circle,rgba(255,213,79,0.5) 0%,transparent 70%)" }}
                  />
                  <div className="relative" style={{ fontSize: isSel ? 32 : 26, filter: "drop-shadow(0 0 12px rgba(255,213,79,0.8))", lineHeight: 1 }}>
                    🌸
                  </div>
                  <span className="absolute -right-3.5 -top-2.5 rounded-full bg-[rgba(255,179,0,0.95)] px-1.5 py-0.5 text-[11px] font-bold text-[#0A0500]">
                    v{b.version}
                  </span>
                  {!isSel && (
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/85 backdrop-blur">
                      {b.title}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}

        <div className="absolute bottom-5 left-1/2 z-[3] -translate-x-1/2 text-center">
          <p className="text-xs italic text-white/35">Tap a 🌸 to explore its knowledge lineage</p>
        </div>
      </div>

      {/* Lineage panel */}
      {active && (
        <div className="relative z-10 w-full max-w-[360px] shrink-0 overflow-y-auto border-l border-[rgba(76,175,80,0.2)] bg-[rgba(4,10,4,0.95)] p-5 backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow mb-1 text-bloom">🌸 Bloomed · v{active.version}</p>
              <h2 className="serif-lg">{active.title}</h2>
            </div>
            <button onClick={() => setSelected(null)} className="text-ink-soft hover:text-ink">✕</button>
          </div>
          <div className="mb-5 text-sm leading-relaxed text-ink-mid">
            <BloomContent text={active.summary} />
          </div>

          <p className="eyebrow mb-2">Lineage — who grew this</p>
          <div className="space-y-2">
            {active.contributors.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-[rgba(255,255,255,0.04)] p-2">
                <Avatar name={c.name} size={28} />
                <div>
                  <p className="text-sm text-ink">{c.name || "A contributor"}</p>
                  <p className="text-xs text-ink-soft">{c.role}</p>
                </div>
              </div>
            ))}
          </div>

          <Link href={`/blooms/${active.id}`} className="btn-ghost mt-5 w-full">
            Open full bloom →
          </Link>
        </div>
      )}
    </div>
  );
}
