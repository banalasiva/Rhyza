"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPatch } from "@/lib/client";

// First sign-in welcome: people who join via the email magic-link never set a
// display name. Rather than leave them as "Someone" (untaggable, faceless), we
// greet them once and ask what to call them — pre-filled with a friendly guess
// from their email, so it's usually one tap. Shown by NavBar only when the
// account still has no name; dismissible, and never nags again this session.
export function NamePrompt({ suggested }: { suggested: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggested === "Someone" ? "" : suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  async function save() {
    const next = value.trim();
    if (!next) {
      setError("Please enter a name so people can recognize you.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPatch("/api/me/name", { name: next });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your name — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[rgba(76,175,80,0.25)] bg-[#0B120B] p-5 shadow-2xl">
        <div className="mb-1 text-3xl">🌱</div>
        <h2 className="serif-lg mb-1">Welcome — what should we call you?</h2>
        <p className="mb-4 text-xs text-ink-soft">
          This is the name others see on your thoughts and in mentions. You can change it anytime.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          maxLength={50}
          placeholder="Your name"
          className="mb-2 w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2.5 text-base text-ink outline-none focus:border-accent"
        />
        {error && <p className="mb-2 text-xs text-[#e57373]">{error}</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDone(true)}
            className="text-xs text-ink-soft transition hover:text-ink"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
