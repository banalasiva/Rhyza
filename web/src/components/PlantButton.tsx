"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavIcon } from "@/components/nav-items";
import { CreateGardenForm } from "@/components/CreateGardenForm";
import { WaitingForThem } from "@/components/WaitingForThem";

type GardenNode = { id: string; name: string; emoji: string };

// The central "Plant" create-and-manage hub, replacing the old Explore tab. Tap
// it and a sheet comes up with everything about *starting* things — plant a seed
// in a garden, start a new garden, and the people you invited who haven't joined
// yet ("waiting for them"). Home stays purely for consuming seeds.
export function PlantButton({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();
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

  // Open the Plant sheet when navigated in with #new-garden or #plant — this is
  // how the side-panel "✚ New garden" / "Plant a seed" links reach the create
  // form, which now lives in this modal rather than on the home page. Only the
  // bottom-nav instance listens (it's always mounted) so we never open two
  // sheets. The hash is cleared after opening so clicking the same link again
  // re-fires it.
  useEffect(() => {
    if (variant !== "bottom") return;
    const check = () => {
      const h = window.location.hash;
      if (h === "#new-garden" || h === "#plant") {
        openSheet();
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    // Direct, reliable trigger the side panel dispatches — no dependence on Next
    // Link firing a hashchange (which it doesn't for a same-page hash click, so
    // the old #new-garden link silently did nothing when already on home).
    const onPlant = () => openSheet();
    check(); // on mount AND whenever the route changes (covers cross-page nav)
    window.addEventListener("hashchange", check); // covers same-page hash clicks
    window.addEventListener("tt:plant", onPlant);
    return () => {
      window.removeEventListener("hashchange", check);
      window.removeEventListener("tt:plant", onPlant);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, pathname]);

  const trigger =
    variant === "bottom" ? (
      <button
        onClick={openSheet}
        aria-label="Plant a seed"
        className="flex flex-1 flex-col items-center gap-0.5 py-2 transition"
        style={{ color: "var(--accent)" }}
      >
        {/* Same h-8 w-14 pill as the other tabs so the 🌱 sits at the exact
            same size and vertical position — no more floating higher. */}
        <span className="relative flex h-8 w-14 items-center justify-center rounded-full text-[20px] leading-none transition-all">
          <span aria-hidden>🌱</span>
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
            aria-label="Start something"
            className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">🌱 What would you like to start?</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Plant a seed — pick a garden to put your question in */}
            <p className="eyebrow mb-1">🌱 Plant a seed <span className="normal-case tracking-normal">· start a decision</span></p>
            <p className="mb-3 text-xs text-ink-soft">
              Got a thought or a decision you’d love to talk through together? Let’s plant it 🌱 —
              which garden should it grow in?
            </p>
            {loading && !gardens && <p className="py-2 text-sm text-ink-soft">Loading your gardens…</p>}
            {gardens && gardens.length > 0 && (
              <div className="space-y-1.5">
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
              <p className="text-xs text-ink-soft">
                No gardens yet — and every seed needs a home to grow in. Shall we start your first
                one? 👇
              </p>
            )}

            {/* Start a new garden */}
            <div className="mt-5 border-t border-[rgba(255,255,255,0.08)] pt-4">
              <p className="eyebrow mb-2">🌿 Need a fresh space?</p>
              <CreateGardenForm />
            </div>

            {/* Waiting for them — invited people who haven't joined (renders
                nothing when there are none). */}
            <div className="mt-4">
              <WaitingForThem />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
