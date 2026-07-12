"use client";

import { useState } from "react";
import Link from "next/link";
import { NavIcon } from "@/components/nav-items";

type GardenNode = { id: string; name: string; emoji: string };

// The central "Plant a seed" create action, replacing the old Explore tab. Tap
// it and a sheet comes up: pick a garden to plant your question in, or start a
// new garden. This is the app's core action, so it lives front-and-centre —
// discovery moved to Home.
export function PlantButton({ variant }: { variant: "bottom" | "top" }) {
  const [open, setOpen] = useState(false);
  const [gardens, setGardens] = useState<GardenNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (gardens) return;
    setLoading(true);
    try {
      const res = await fetch("/api/me/tree", { cache: "no-store" });
      const json = await res.json();
      setGardens(json?.gardens ?? json?.data?.gardens ?? []);
    } catch {
      setGardens([]);
    } finally {
      setLoading(false);
    }
  }
  function openSheet() {
    setOpen(true);
    void load();
  }

  const trigger =
    variant === "bottom" ? (
      <button
        onClick={openSheet}
        aria-label="Plant a seed"
        className="flex flex-1 flex-col items-center gap-0.5 py-2 transition"
        style={{ color: "var(--accent)" }}
      >
        <span className="text-[20px] leading-none" aria-hidden>
          🌱
        </span>
        <span className="text-[11px] font-medium">Plant</span>
      </button>
    ) : (
      <button
        onClick={openSheet}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-[rgba(76,175,80,0.1)]"
        style={{ color: "var(--accent)" }}
      >
        <NavIcon name="plant" size={18} />
        Plant
      </button>
    );

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Plant a seed"
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">🌱 Plant a seed</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-ink-soft">
              A seed is a question or decision for a group. Pick a garden to plant it in — or start a
              new one.
            </p>

            {loading && !gardens && <p className="py-3 text-sm text-ink-soft">Loading your gardens…</p>}

            {gardens && gardens.length > 0 && (
              <div className="max-h-[45vh] space-y-1.5 overflow-auto">
                {gardens.map((g) => (
                  <Link
                    key={g.id}
                    href={`/gardens/${g.id}#plant-seed`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 transition hover:border-accent"
                  >
                    <span className="text-lg" aria-hidden>{g.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.name}</span>
                    <span className="shrink-0 text-xs text-accent">Plant →</span>
                  </Link>
                ))}
              </div>
            )}

            {gardens && gardens.length === 0 && !loading && (
              <p className="mb-1 text-xs text-ink-soft">
                You don’t have a garden yet — every seed lives in one. Start your first:
              </p>
            )}

            <Link
              href="/#new-garden"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(76,175,80,0.45)] bg-[rgba(76,175,80,0.12)] px-3 py-2.5 text-sm font-medium text-ink transition hover:border-accent active:scale-[0.98]"
            >
              ✚ New garden
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
