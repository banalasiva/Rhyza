"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

// The guided "start your first decision" — one input instead of the old
// create-a-garden-then-a-seed-then-add-people maze. You type one real decision,
// Claude replies first, then you add your people. Warm, minimal, hand-held.
const EXAMPLES = [
  "Which school for our kid?",
  "Where should we go for the holidays?",
  "Should we take the new job offer?",
  "How do we care for our parents?",
];

export function FirstDecision() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const t = title.trim();
    if (t.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { seedId } = await apiPost<{ seedId: string }>("/api/quick-start", { title: t });
      router.push(`/seeds/${seedId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div
      className="card p-4 sm:p-5"
      style={{ borderColor: "rgba(76,175,80,0.35)", background: "rgba(76,175,80,0.05)" }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
          style={{ background: "rgba(76,175,80,0.2)", color: "#66BB6A" }}
        >
          ✦
        </span>
        <p className="text-sm font-semibold text-ink">Start your first decision</p>
      </div>
      <p className="mb-3 text-sm text-ink-mid">
        What’s one thing you’d love to sort out with your family or friends?
      </p>

      <textarea
        className="input min-h-[52px] w-full"
        placeholder="Type it in your own words…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) start();
        }}
      />

      {/* Tap an example to fill it in — removes the blank-page freeze. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setTitle(ex)}
            className="rounded-full border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-2.5 py-1 text-[11px] text-ink-mid transition hover:border-accent"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-[#e57373]">{error}</p>}

      <button
        onClick={start}
        disabled={busy || title.trim().length < 4}
        className="btn-primary mt-3 w-full disabled:opacity-50"
      >
        {busy ? "Starting…" : "✨ Start — Claude replies right away"}
      </button>
      <p className="mt-2 text-center text-[11px] text-ink-soft">
        Claude answers first, then you add your people 🌱
      </p>
    </div>
  );
}
