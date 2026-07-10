"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReadAloud } from "@/components/ReadAloud";
import { InlineText } from "@/components/InlineText";
import { shareCard } from "@/lib/share-card";

// Strip the tiny markdown (bold markers, leading bullets) for plain contexts
// like read-aloud and the share card headline.
function plain(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/^[\s•\-*]+/gm, "")
    .trim();
}

// The bloom's title + summary, with inline editing. Blooms are AI-synthesized
// but collaborative — any member can refine the text.
export function BloomBody({
  id,
  initialTitle,
  initialSummary,
  aiSynthesized,
}: {
  id: string;
  initialTitle: string;
  initialSummary: string;
  aiSynthesized: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftSummary, setDraftSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synth, setSynth] = useState(aiSynthesized);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  async function share() {
    // A bloom is a durable decision — worth showing off. Turn it into a card
    // that carries the decision (and a taste of the reasoning) out to wherever
    // people already talk.
    const firstLine = plain(summary.split(/\n+/).find((l) => l.trim()) ?? "");
    try {
      const how = await shareCard(
        {
          eyebrow: "A decision, thought through",
          title,
          lines: firstLine && firstLine !== title ? [truncate(firstLine, 140)] : undefined,
          footer: "Grown together on ThinkThru · thinkthru.app",
          accent: "bloom",
        },
        {
          fileName: "thinkthru-bloom.png",
          shareText: `${title} — a decision we thought through together on ThinkThru. https://thinkthru.app`,
        },
      );
      if (how === "downloaded") {
        setShareMsg("Saved — share it anywhere 🌸");
        setTimeout(() => setShareMsg(null), 3000);
      }
    } catch {
      setShareMsg("Couldn't make the card");
      setTimeout(() => setShareMsg(null), 3000);
    }
  }

  async function save() {
    const t = draftTitle.trim();
    const s = draftSummary.trim();
    if (t.length < 4 || s.length < 1) {
      setError("Title and summary can't be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/blooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, summary: s }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Failed to save");
      }
      setTitle(t);
      setSummary(s);
      setSynth(false);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2">
        <input
          className="input mb-3 text-center text-lg"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
        />
        <textarea
          className="input min-h-[260px] leading-relaxed"
          value={draftSummary}
          onChange={(e) => setDraftSummary(e.target.value)}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-[#e57373]">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
              setDraftTitle(title);
              setDraftSummary(summary);
            }}
            className="btn-ghost px-4 py-2 text-sm"
            disabled={busy}
          >
            Cancel
          </button>
          <button onClick={save} className="btn-primary text-sm" disabled={busy}>
            {busy ? "Saving…" : "Save bloom"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="serif-xl mb-2">{title}</h1>
        {synth && (
          <p className="mb-4 text-xs text-ink-soft">✦ Synthesized by Claude — edit anytime</p>
        )}
      </div>

      <article className="card bloom-body p-6 text-[15px] leading-relaxed text-ink">
        <InlineText text={summary} />
      </article>

      <div className="mt-3 flex items-center justify-between gap-2">
        <ReadAloud text={`${title}. ${plain(summary)}`} />
        <div className="flex items-center gap-2">
          <button onClick={share} className="btn-ghost px-4 py-1.5 text-xs">
            ↗ Share
          </button>
          <button onClick={() => setEditing(true)} className="btn-ghost px-4 py-1.5 text-xs">
            ✎ Edit bloom
          </button>
        </div>
      </div>
      {shareMsg && <p className="mt-2 text-right text-xs text-ink-soft">{shareMsg}</p>}
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
