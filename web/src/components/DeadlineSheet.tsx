"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";

// The deadline SETUP, as a bottom sheet opened from the seed's details — the
// same place Members lives — so a fresh thread isn't cluttered with a "set a
// deadline?" card. The live countdown itself still shows in the thread (that's
// a working clock everyone paces to); this is just where you set / change / clear
// it. Steward-only.

type Deadline = {
  mode: "paced" | "peaceful";
  discussBy: string | null;
  decideBy: string | null;
  setById: string;
  updatedAt: string;
} | null;

export function DeadlineSheet({ seedId, onClose }: { seedId: string; onClose: () => void }) {
  const [dl, setDl] = useState<Deadline>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discussDays, setDiscussDays] = useState(2);
  const [decideDays, setDecideDays] = useState(1);
  const closedRef = useRef(false);

  useEffect(() => {
    apiGet<Deadline>(`/api/seeds/${seedId}/deadline`)
      .then((d) => setDl(d))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [seedId]);

  // Notify the thread's live clock to refresh, then close.
  function finish() {
    if (closedRef.current) return;
    closedRef.current = true;
    try {
      window.dispatchEvent(new CustomEvent("tt:deadline-changed"));
    } catch {
      /* no-op */
    }
    onClose();
  }

  async function post(body: unknown) {
    setBusy(true);
    try {
      await apiPost<Deadline>(`/api/seeds/${seedId}/deadline`, body);
      finish();
    } catch {
      setBusy(false);
    }
  }

  const current =
    dl?.mode === "peaceful"
      ? "🕊️ No deadline — taking the time you need."
      : dl?.mode === "paced"
        ? "⏱️ A timer is running on this seed."
        : "No deadline yet.";

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Deadline"
        className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+4.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">⏰ Deadline</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft transition hover:text-ink">
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-ink-soft">{loaded ? current : "Loading…"}</p>

        <p className="mb-3 text-xs text-ink-soft">
          Pick how long to talk it over, then how long to decide. The countdown starts right away, and
          everyone gets a friendly reminder when time&apos;s up.
        </p>

        {/* Paced */}
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3">
          <p className="mb-2 text-xs font-semibold text-ink">⏱️ Set a deadline</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-mid">
            <NumBox value={discussDays} onChange={setDiscussDays} /> days to
            <span className="text-ink">talk</span>
            <span className="text-ink-soft">·</span>
            <NumBox value={decideDays} onChange={setDecideDays} /> more to
            <span className="text-ink">decide</span>
          </div>
          <button
            onClick={() => post({ mode: "paced", discussDays, decideDays })}
            disabled={busy}
            className="btn-primary mt-3 w-full py-1.5 text-sm"
          >
            {busy ? "Starting…" : "▶️ Start the timer"}
          </button>
        </div>

        {/* Peaceful */}
        <button
          onClick={() => post({ mode: "peaceful" })}
          disabled={busy}
          className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(7,13,7,0.35)] p-3 text-left transition hover:border-accent disabled:opacity-60"
        >
          <span aria-hidden className="text-base">🕊️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink">No deadline</span>
            <span className="block text-xs text-ink-soft">Take all the time we need.</span>
          </span>
        </button>

        {dl && (
          <button
            onClick={() => post({ mode: "clear" })}
            disabled={busy}
            className="mt-4 text-xs text-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
          >
            Remove deadline
          </button>
        )}
      </div>
    </div>
  );
}

function NumBox({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.06)]">
      <button
        type="button"
        aria-label="fewer"
        onClick={() => onChange(Math.max(0, +(value - (value <= 1 ? 0.5 : 1)).toFixed(1)))}
        className="px-2 py-1 text-ink-soft transition hover:text-ink"
      >
        −
      </button>
      <span className="min-w-[2.5ch] text-center text-sm font-semibold text-ink">{value}</span>
      <button
        type="button"
        aria-label="more"
        onClick={() => onChange(Math.min(30, +(value + 1).toFixed(1)))}
        className="px-2 py-1 text-ink-soft transition hover:text-ink"
      >
        +
      </button>
    </span>
  );
}
