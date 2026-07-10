"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

type Kind = "bug" | "idea" | "other";
const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: "bug", label: "Bug", icon: "🐞" },
  { key: "idea", label: "Idea", icon: "💡" },
  { key: "other", label: "Other", icon: "💬" },
];

// A quiet, always-there way to report a bug or share an idea. Captures the page
// you're on automatically, so the report is actually actionable. Reaches the
// owner instantly — the fast lane from "something's off" to a fix.
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/feedback", {
        kind,
        message: message.trim(),
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      setDone(true);
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setKind("bug");
      }, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback or report a bug"
        title="Send feedback"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(76,175,80,0.25)] text-base text-ink-soft transition hover:border-[rgba(76,175,80,0.5)] hover:text-ink"
      >
        <span aria-hidden>🐞</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Send feedback"
            className="relative z-10 max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 shadow-2xl sm:rounded-2xl"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Send feedback</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {done ? (
              <p className="py-8 text-center text-sm text-accent">
                Thank you 🌱 — this went straight to the team.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[11px] text-ink-soft">
                  Found a bug or have an idea? Tell us — it reaches the team right away.
                </p>

                <div className="mb-3 flex gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.key}
                      onClick={() => setKind(k.key)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition ${
                        kind === k.key
                          ? "border-accent bg-[rgba(76,175,80,0.14)] text-ink"
                          : "border-[rgba(76,175,80,0.2)] text-ink-mid hover:text-ink"
                      }`}
                    >
                      {k.icon} {k.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="input min-h-[120px] leading-relaxed"
                  placeholder={
                    kind === "bug"
                      ? "What happened? What did you expect? (The page you're on is included automatically.)"
                      : kind === "idea"
                        ? "What would make ThinkThru better for you?"
                        : "Tell us anything…"
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  autoFocus
                />

                {error && <p className="mt-2 text-xs text-[#e57373]">{error}</p>}

                <button
                  onClick={send}
                  disabled={busy || !message.trim()}
                  className="btn-primary mt-3 w-full text-sm disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
