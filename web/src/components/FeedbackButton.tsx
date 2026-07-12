"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { apiPost } from "@/lib/client";

type Kind = "bug" | "idea" | "other";
const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: "bug", label: "Bug", icon: "🐞" },
  { key: "idea", label: "Idea", icon: "💡" },
  { key: "other", label: "Other", icon: "💬" },
];

// A quiet, always-there way to report a bug or share an idea. Captures the page
// you're on automatically, and lets you paste or attach a screenshot — so a bug
// report is actually actionable. Reaches the owner instantly.
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await upload(file.name || "screenshot.png", file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setImageUrl(blob.url);
    } catch {
      setError("Couldn't attach that image — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      await doUpload(file);
    }
  }

  function reset() {
    setOpen(false);
    setDone(false);
    setKind("bug");
    setMessage("");
    setImageUrl(null);
  }

  const canSend = (!!message.trim() || !!imageUrl) && !busy && !uploading;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const body = (message.trim() || "(screenshot attached)") + (imageUrl ? `\n\n![screenshot](${imageUrl})` : "");
      await apiPost("/api/feedback", {
        kind,
        message: body,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      setDone(true);
      setMessage("");
      setImageUrl(null);
      setTimeout(reset, 1600);
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
        // Anchored to the TOP (with a small offset) so the Send button always
        // stays above the on-screen keyboard and the fixed bottom nav — the old
        // bottom-sheet buried it. dvh shrinks with the keyboard so it never
        // overflows.
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Send feedback"
            className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-auto rounded-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 shadow-2xl"
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
                  Found a bug or have an idea? Tell us — you can paste or attach a screenshot too.
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
                  className="input min-h-[100px] leading-relaxed"
                  placeholder={
                    kind === "bug"
                      ? "What happened? What did you expect? (Paste a screenshot right here — the page you're on is included automatically.)"
                      : kind === "idea"
                        ? "What would make ThinkThru better for you?"
                        : "Tell us anything…"
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onPaste={onPaste}
                  autoFocus
                />

                {/* Screenshot: paste into the box above, or attach a file. */}
                {imageUrl ? (
                  <div className="relative mt-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Attached screenshot"
                      className="max-h-40 rounded-lg border border-[rgba(255,255,255,0.12)]"
                    />
                    <button
                      onClick={() => setImageUrl(null)}
                      aria-label="Remove screenshot"
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[rgba(76,175,80,0.25)] px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink">
                    {uploading ? "Uploading…" : "📎 Attach screenshot"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void doUpload(f);
                      }}
                    />
                  </label>
                )}

                {error && <p className="mt-2 text-xs text-[#e57373]">{error}</p>}

                <button
                  onClick={send}
                  disabled={!canSend}
                  className="btn-primary mt-3 w-full text-sm disabled:opacity-50"
                >
                  {busy ? "Sending…" : uploading ? "Uploading…" : "Send"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
