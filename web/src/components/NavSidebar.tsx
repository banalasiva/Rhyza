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

const STORAGE_KEY = "thinkthru_nav_open";

// A slide-in left panel listing the viewer's gardens and seeds (private/public,
// alphabetical, with bloom counts). Remembers open/closed across pages.
// `signOut` is a server action passed down from the (server) NavBar.
export function NavSidebar({ signOut }: { signOut?: () => void }) {
  const [open, setOpen] = useState(false);
  const [gardens, setGardens] = useState<GardenNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/me/tree", { cache: "no-store" });
      const json = await res.json();
      // The API returns { gardens: [...] } at the top level (not under .data).
      setGardens(json?.gardens ?? json?.data?.gardens ?? []);
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

  const priv = gardens?.filter((g) => g.visibility === "private") ?? [];
  const pub = gardens?.filter((g) => g.visibility === "public") ?? [];

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
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">🌱 Your gardens</span>
              <button onClick={() => setOpenPersist(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>

            {/* Quick create — plant a whole new garden, or jump into one below to
                plant a seed inside it. */}
            <Link
              href="/#new-garden"
              onClick={() => setOpenPersist(false)}
              className="mb-5 flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(76,175,80,0.45)] bg-[rgba(76,175,80,0.12)] px-3 py-2.5 text-sm font-medium text-ink transition hover:border-accent active:scale-[0.98] active:border-accent active:bg-[rgba(76,175,80,0.3)]"
            >
              ✚ New garden
            </Link>

            {loading && gardens === null && <p className="text-sm text-ink-soft">Loading…</p>}
            {gardens?.length === 0 && !loading && (
              <p className="text-sm text-ink-soft">No gardens yet — plant your first one above.</p>
            )}

            <div className="space-y-6">
              {priv.length > 0 && (
                <GardenSection title="Private" glyph="🔒" gardens={priv} close={() => setOpenPersist(false)} />
              )}
              {pub.length > 0 && (
                <GardenSection title="Public" glyph="🌍" gardens={pub} close={() => setOpenPersist(false)} />
              )}
            </div>

            {/* Account actions pinned at the bottom of the panel. Extra bottom
                padding so Sign out clears the fixed bottom navigation bar. */}
            {signOut && (
              <div className="mt-6 border-t border-[rgba(76,175,80,0.15)] pb-24 pt-3">
                <Link
                  href="/roots"
                  onClick={() => setOpenPersist(false)}
                  className="mb-1 block rounded-lg px-1 py-1.5 text-sm text-ink-mid transition hover:text-ink"
                >
                  🌳 What you&apos;ve grown
                </Link>
                <Link
                  href="/kept"
                  onClick={() => setOpenPersist(false)}
                  className="mb-1 block rounded-lg px-1 py-1.5 text-sm text-ink-mid transition hover:text-ink"
                >
                  🔖 Kept
                </Link>
                <Link
                  href="/judgement"
                  onClick={() => setOpenPersist(false)}
                  className="mb-1 block rounded-lg px-1 py-1.5 text-sm text-ink-mid transition hover:text-ink"
                >
                  🪞 Judgement
                </Link>
                <Link
                  href="/lessons"
                  onClick={() => setOpenPersist(false)}
                  className="mb-1 block rounded-lg px-1 py-1.5 text-sm text-ink-mid transition hover:text-ink"
                >
                  💡 Lessons
                </Link>
                <Link
                  href="/share"
                  onClick={() => setOpenPersist(false)}
                  className="mb-1 block rounded-lg px-1 py-1.5 text-sm text-ink-mid transition hover:text-ink"
                >
                  🎴 Share your ThinkThru
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpenPersist(false)}
                  className="mb-1 block rounded-lg px-1 py-1.5 text-sm text-ink-mid transition hover:text-ink"
                >
                  🔑 Sign-in &amp; security
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full rounded-lg px-1 py-1.5 text-left text-sm text-ink-soft transition hover:text-[#e57373]"
                  >
                    ↩ Sign out
                  </button>
                </form>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

// One labelled group of gardens (Private or Public) with its seeds nested and a
// per-garden shortcut to plant a new seed inside it.
function GardenSection({
  title,
  glyph,
  gardens,
  close,
}: {
  title: string;
  glyph: string;
  gardens: GardenNode[];
  close: () => void;
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-soft">
        {glyph} {title} gardens
      </p>
      <div className="space-y-3">
        {gardens.map((g) => {
          const blooms = g.seeds.filter((s) => s.bloomed).length;
          return (
            <div key={g.id}>
              <Link
                href={`/gardens/${g.id}`}
                onClick={close}
                className="flex items-center gap-2 text-sm font-medium text-ink transition hover:text-accent"
              >
                <span>{g.emoji}</span>
                <span className="flex-1 truncate">{g.name}</span>
                {blooms > 0 && <span className="text-[10px] text-bloom">🌸 {blooms}</span>}
              </Link>
              <ul className="mt-1 space-y-0.5 border-l border-[rgba(76,175,80,0.15)] pl-3">
                {g.seeds.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/seeds/${s.id}`}
                      onClick={close}
                      className="flex items-center gap-1.5 py-0.5 text-xs text-ink-mid transition hover:text-ink"
                    >
                      <span className="shrink-0 text-[10px]">
                        {s.bloomed ? "🌸" : s.visibility === "private" ? "🔒" : "🌱"}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href={`/gardens/${g.id}#plant-seed`}
                    onClick={close}
                    className="-ml-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-ink-soft transition hover:text-accent active:bg-[rgba(76,175,80,0.16)] active:text-accent"
                  >
                    <span className="shrink-0 text-[10px]">✚</span>
                    <span>Plant a seed</span>
                  </Link>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
