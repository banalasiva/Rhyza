"use client";

import { useState } from "react";
import Link from "next/link";

type SeedNode = { id: string; title: string; visibility: "public" | "private"; bloomed: boolean };
type GardenNode = {
  id: string;
  name: string;
  emoji: string;
  visibility: "public" | "private";
  seeds: SeedNode[];
};

// A slide-in left drawer listing the viewer's gardens and seeds (private/public,
// alphabetical). Opened from the ☰ button in the nav.
export function NavSidebar() {
  const [open, setOpen] = useState(false);
  const [gardens, setGardens] = useState<GardenNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/me/tree", { cache: "no-store" });
      const json = await res.json();
      setGardens(json?.data?.gardens ?? []);
    } catch {
      setGardens([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && gardens === null) load();
  }

  return (
    <>
      <button
        onClick={toggle}
        title="Your gardens & seeds"
        className="rounded-full border border-[rgba(76,175,80,0.2)] px-2.5 py-1 text-sm text-ink-mid transition hover:text-ink"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-[120]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)]" />
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 h-full w-[300px] max-w-[85vw] overflow-auto border-r border-[rgba(76,175,80,0.18)] bg-[rgba(8,13,8,0.98)] p-4 backdrop-blur animate-[fadeUp_0.25s_ease-out]"
          >
            <div className="mb-3 flex items-center justify-between">
              <Link href="/" onClick={() => setOpen(false)} className="eyebrow">
                🌱 Your gardens
              </Link>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>

            {loading && <p className="text-sm text-ink-soft">Loading…</p>}
            {gardens?.length === 0 && !loading && (
              <p className="text-sm text-ink-soft">No gardens yet.</p>
            )}

            <div className="space-y-4">
              {gardens?.map((g) => (
                <div key={g.id}>
                  <Link
                    href={`/gardens/${g.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-ink transition hover:text-accent"
                  >
                    <span>{g.emoji}</span>
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className="text-[10px] text-ink-soft">
                      {g.visibility === "private" ? "🔒" : "🌍"}
                    </span>
                  </Link>
                  {g.seeds.length > 0 && (
                    <ul className="mt-1 space-y-0.5 border-l border-[rgba(76,175,80,0.15)] pl-3">
                      {g.seeds.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/seeds/${s.id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-1.5 py-0.5 text-xs text-ink-mid transition hover:text-ink"
                          >
                            <span className="shrink-0 text-[10px]">
                              {s.bloomed ? "🌸" : s.visibility === "private" ? "🔒" : "🌱"}
                            </span>
                            <span className="truncate">{s.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
