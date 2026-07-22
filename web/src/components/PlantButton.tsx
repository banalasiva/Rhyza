"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { NavIcon } from "@/components/nav-items";
import { CreateGardenForm } from "@/components/CreateGardenForm";
import { WaitingForThem } from "@/components/WaitingForThem";
import { apiPost } from "@/lib/client";

type GardenNode = { id: string; name: string; emoji: string };

// The central "Plant" create hub. Tapping it opens a sheet whose FIRST and
// biggest thing is a single box: type what you want to figure out, hit Start,
// and you're in a live thread — no "which garden should it grow in?" gate. The
// seed lands in your personal default garden (auto-created server-side). Filing
// into a specific garden is still here, but tucked behind an optional
// disclosure so it never blocks the newcomer. This is the WhatsApp "just start
// a chat" model applied to decisions.
export function PlantButton({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gardens, setGardens] = useState<GardenNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick-plant state
  const [title, setTitle] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGardens, setShowGardens] = useState(false);

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
    setError(null);
    void load();
  }

  // Open the Plant sheet when navigated in with #new-garden or #plant, or when
  // the side panel dispatches the tt:plant event. Only the always-mounted
  // bottom-nav instance listens so we never open two sheets. The hash is cleared
  // after opening so clicking the same link again re-fires it.
  useEffect(() => {
    if (variant !== "bottom") return;
    const check = () => {
      const h = window.location.hash;
      if (h === "#new-garden" || h === "#plant") {
        openSheet();
        if (h === "#new-garden") setShowGardens(true);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    const onPlant = (e: Event) => {
      openSheet();
      // The side-panel "New garden" opens straight into the gardens section.
      if ((e as CustomEvent).detail?.gardens) {
        setShowGardens(true);
        void load();
      }
    };
    check();
    window.addEventListener("hashchange", check);
    window.addEventListener("tt:plant", onPlant);
    return () => {
      window.removeEventListener("hashchange", check);
      window.removeEventListener("tt:plant", onPlant);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, pathname]);

  async function quickPlant() {
    const t = title.trim();
    if (t.length < 4) {
      setError("Just a few more words so people know what it's about.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const { id } = await apiPost<{ id: string }>("/api/seeds", { title: t });
      if (!id) throw new Error("no id");
      setTitle("");
      setOpen(false);
      router.push(`/seeds/${id}`);
    } catch {
      setError("Couldn't start it just now — try again in a moment.");
      setPosting(false);
    }
  }

  const trigger =
    variant === "bottom" ? (
      <button
        onClick={openSheet}
        aria-label="Start a decision"
        className="flex flex-1 flex-col items-center gap-0.5 py-2 transition"
        style={{ color: "var(--accent)" }}
      >
        <span className="relative flex h-8 w-14 items-center justify-center rounded-full text-[20px] leading-none transition-all">
          <span aria-hidden>🌱</span>
        </span>
        <span className="text-[11px] font-medium">Start</span>
      </button>
    ) : (
      <button
        onClick={openSheet}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-[rgba(76,175,80,0.1)]"
        style={{ color: "var(--accent)" }}
      >
        <NavIcon name="plant" size={18} />
        Start
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
            aria-label="Start a decision"
            className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">🌱 What do you want to figure out?</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* The one box that matters — type it, start it. No garden to pick. */}
            <textarea
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") quickPlant();
              }}
              rows={3}
              placeholder="e.g. Where should we go for the December trip?"
              className="w-full resize-none rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(7,13,7,0.5)] p-3 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
            />
            {error && <p className="mt-1.5 text-xs text-[#e57373]">{error}</p>}
            <button
              onClick={quickPlant}
              disabled={posting}
              className="btn-primary mt-3 w-full text-sm disabled:opacity-60"
            >
              {posting ? "Starting…" : "Start →"}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-soft">
              Private to you until you add people. Claude opens with a first thought.
            </p>

            {/* Optional: file it into a specific garden instead. Tucked away so it
                never blocks the quick path, for people who like to organise. */}
            <div className="mt-4 border-t border-[rgba(255,255,255,0.08)] pt-3">
              <button
                onClick={() => {
                  setShowGardens((v) => !v);
                  if (!showGardens) void load();
                }}
                aria-expanded={showGardens}
                className="flex w-full items-center justify-between text-xs text-ink-soft transition hover:text-ink"
              >
                <span>🗂 Put it in a specific garden instead</span>
                <span aria-hidden>{showGardens ? "▴" : "▾"}</span>
              </button>

              {showGardens && (
                <div className="mt-3">
                  {loading && !gardens && (
                    <p className="py-2 text-sm text-ink-soft">Loading your gardens…</p>
                  )}
                  {gardens && gardens.length > 0 && (
                    <div className="space-y-1.5">
                      {gardens.map((g) => (
                        <Link
                          key={g.id}
                          href={`/gardens/${g.id}#plant-seed`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 transition hover:border-accent"
                        >
                          <span className="text-lg" aria-hidden>
                            {g.emoji}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.name}</span>
                          <span className="shrink-0 text-xs text-accent">Open →</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="eyebrow mb-2">🌿 Or start a new garden</p>
                    <CreateGardenForm />
                  </div>
                </div>
              )}
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
