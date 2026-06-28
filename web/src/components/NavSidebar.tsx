"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SeedNode = { id: string; title: string; visibility: "public" | "private"; bloomed: boolean };
type GardenNode = {
  id: string;
  name: string;
  emoji: string;
  visibility: "public" | "private";
  seeds: SeedNode[];
};

const STORAGE_KEY = "rhyza_nav_open";

// A slide-in left panel listing the viewer's gardens and seeds (private/public,
// alphabetical, with bloom counts). Remembers open/closed across pages.
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

  // Restore the remembered open state on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setOpen(true);
        load();
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  function setOpenPersist(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next && gardens === null) load();
  }

  // Esc closes the drawer (WCAG 2.1.2 — no keyboard trap).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPersist(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpenPersist(!open)}
        title="Your gardens & seeds"
        aria-label="Your gardens and seeds"
        aria-expanded={open}
        className="rounded-full border border-[rgba(76,175,80,0.2)] px-2.5 py-1 text-sm text-ink-mid transition hover:text-ink"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-[120]">
          {/* light, non-darkening scrim — a real button so it's keyboard-operable */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpenPersist(false)}
            className="absolute inset-0 cursor-default bg-[rgba(0,0,0,0.18)]"
          />
          <aside
            className="absolute left-0 top-0 h-full w-[300px] max-w-[85vw] overflow-auto border-r border-[rgba(76,175,80,0.18)] bg-[rgba(8,13,8,0.98)] p-4 backdrop-blur animate-[fadeUp_0.25s_ease-out]"
          >
            <div className="mb-3 flex items-center justify-between">
              <Link href="/" onClick={() => setOpenPersist(false)} className="eyebrow">
                🌱 Your gardens
              </Link>
              <button onClick={() => setOpenPersist(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>

            {loading && gardens === null && <p className="text-sm text-ink-soft">Loading…</p>}
            {gardens?.length === 0 && !loading && (
              <p className="text-sm text-ink-soft">No gardens yet.</p>
            )}

            <div className="space-y-4">
              {gardens?.map((g) => {
                const blooms = g.seeds.filter((s) => s.bloomed).length;
                return (
                  <div key={g.id}>
                    <Link
                      href={`/gardens/${g.id}`}
                      onClick={() => setOpenPersist(false)}
                      className="flex items-center gap-2 text-sm font-medium text-ink transition hover:text-accent"
                    >
                      <span>{g.emoji}</span>
                      <span className="flex-1 truncate">{g.name}</span>
                      {blooms > 0 && <span className="text-[10px] text-bloom">🌸 {blooms}</span>}
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
                              onClick={() => setOpenPersist(false)}
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
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
