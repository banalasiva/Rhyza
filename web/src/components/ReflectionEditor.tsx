"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// The owner's editable "how you show up" reflection. Reads as a bulleted list;
// tapping Edit reveals a textarea (one point per line) so a person can trim
// anything they'd rather not show, plus a button to regenerate it from their
// activity. Non-owners see the read-only <ReflectionPoints> below.
export function ReflectionEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial); // canonical: points, one per line
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState<null | "save" | "refresh">(null);

  const points = text.split("\n").map((p) => p.trim()).filter(Boolean);

  async function save() {
    setBusy("save");
    try {
      const r = await apiPost<{ reflection: string }>("/api/me/reflection", {
        action: "save",
        text: draft,
      });
      setText(r.reflection);
      setDraft(r.reflection);
      setEditing(false);
    } catch {
      /* keep editing on failure */
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("refresh");
    try {
      const r = await apiPost<{ reflection: string }>("/api/me/reflection", { action: "refresh" });
      setText(r.reflection);
      setDraft(r.reflection);
    } catch {
      /* leave as-is */
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[rgba(76,175,80,0.2)] p-3">
        <p className="mb-2 text-xs text-ink-soft">
          One point per line. Remove anything you&apos;d rather not show, or reword it — it&apos;s
          yours.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.max(4, draft.split("\n").length + 1)}
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-transparent p-2.5 text-sm text-ink outline-none focus:border-accent"
          placeholder="Add a point about how you show up…"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={save}
            disabled={!!busy}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setDraft(text);
              setEditing(false);
            }}
            disabled={!!busy}
            className="btn-ghost text-xs"
          >
            Cancel
          </button>
          <button
            onClick={regenerate}
            disabled={!!busy}
            className="ml-auto text-xs text-ink-soft transition hover:text-accent disabled:opacity-50"
          >
            {busy === "refresh" ? "Regenerating…" : "🔄 Regenerate from my activity"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {points.length > 0 ? (
        <ul className="space-y-1.5">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-mid">
              <span aria-hidden className="mt-[2px] shrink-0 text-accent">
                •
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-soft">
          A short mirror of how you show up will appear here as you take part — you can edit it
          anytime.
        </p>
      )}
      <button
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
        className="mt-3 text-xs text-ink-soft transition hover:text-accent"
      >
        ✏️ Edit
      </button>
    </div>
  );
}

// Read-only bulleted reflection, for viewing someone else's profile.
export function ReflectionPoints({ text }: { text: string }) {
  const points = text.split("\n").map((p) => p.trim()).filter(Boolean);
  if (points.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {points.map((p, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-mid">
          <span aria-hidden className="mt-[2px] shrink-0 text-accent">
            •
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}
