"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReadAloud } from "@/components/ReadAloud";
import { BloomContent } from "@/components/BloomContent";
import { shareBloomCard } from "@/lib/share-card";

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
  question,
  people,
  dimensions,
  credit,
  sharerName,
  contributors,
}: {
  id: string;
  initialTitle: string;
  initialSummary: string;
  aiSynthesized: boolean;
  // Bloom Card inputs — the narrative share artifact.
  question: string; // the seed question (context on the card)
  people: number; // distinct humans who grew this decision
  dimensions: number; // thinking dimensions that lit up
  credit: string | null; // the sharer's own credited role, if any
  sharerName: string; // the viewer's display name, for the credit line
  contributors: string[]; // names of the humans who grew it (for "Grown by …")
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
    // A bloom is a durable decision, grown by a group — the card should feel like
    // that. It leads with the INSIGHT (hero), frames it with the question, NAMES
    // the people who grew it, and carries a QR + link back to the decision so a
    // shared image is never a dead end.
    const insight = distill(summary) || title;
    const stat = [
      `${people} ${people === 1 ? "person" : "people"}`,
      dimensions > 0 ? `${dimensions} ${dimensions === 1 ? "dimension" : "dimensions"}` : "",
      "one decision",
    ]
      .filter(Boolean)
      .join(" · ");
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/blooms/${id}` : `https://thinkthru.app/blooms/${id}`;
    try {
      const how = await shareBloomCard(
        {
          question: title, // bloom.title IS the seed question
          insight,
          grownBy: grownByLine(contributors),
          stat,
          credit: credit ? `${sharerName} · ${credit}` : undefined,
          url,
          footer: "thinkthru.app",
        },
        {
          fileName: "thinkthru-bloom.png",
          shareText: `${truncate(insight, 150)} — a decision we grew together on ThinkThru. ${url}`,
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

  function saveAsPdf() {
    // On mobile this opens the system print sheet; the saved file lands in
    // Downloads. window.print() is a no-op in a few standalone PWAs (notably
    // iOS) — the message tells people how to do it from the browser instead.
    setShareMsg("A print sheet should open — pick “Save as PDF”. It saves to your Downloads.");
    setTimeout(() => {
      try {
        window.print();
      } catch {
        setShareMsg("Open this decision in your browser, then menu → Print → Save as PDF.");
      }
    }, 60);
    setTimeout(() => setShareMsg(null), 6000);
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

      <article className="card p-6 text-[15px] leading-relaxed text-ink">
        <BloomContent text={summary} />
      </article>

      <div className="no-print mt-3 flex items-center justify-between gap-2">
        <ReadAloud text={`${title}. ${plain(summary)}`} />
        <div className="flex items-center gap-2">
          <button onClick={share} className="btn-ghost px-4 py-1.5 text-xs">
            Share
          </button>
          <button
            onClick={saveAsPdf}
            title="Save the full decision record as a PDF"
            className="btn-ghost px-4 py-1.5 text-xs"
          >
            PDF
          </button>
          <button onClick={() => setEditing(true)} className="btn-ghost px-4 py-1.5 text-xs">
            Edit
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

// Pull the crispest opening of the bloom for the card hero: the first sentence
// or two of plain text (not just the raw first line, which can be a fragment),
// capped so the hero stays punchy.
function distill(summary: string): string {
  const text = plain(summary).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    const next = (out ? `${out} ` : "") + s.trim();
    if (out && next.length > 200) break;
    out = next;
    if (out.length >= 120) break; // one strong sentence is usually enough
  }
  return truncate(out, 220);
}

// "Grown by Siva, Priya & 4 others" — names the collective without ever getting
// long. Falls back gracefully when there are no named contributors.
function grownByLine(names: string[]): string | undefined {
  const clean = names.map((n) => (n || "").trim().split(/\s+/)[0]).filter(Boolean);
  if (clean.length === 0) return undefined;
  if (clean.length === 1) return `Grown by ${clean[0]}`;
  if (clean.length === 2) return `Grown by ${clean[0]} & ${clean[1]}`;
  const shown = clean.slice(0, 2);
  const rest = clean.length - shown.length;
  return `Grown by ${shown.join(", ")} & ${rest} ${rest === 1 ? "other" : "others"}`;
}
