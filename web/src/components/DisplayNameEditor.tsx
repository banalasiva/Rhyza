"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPatch } from "@/lib/client";

// The "Hey {first name} 👋" header, with a tap-to-rename affordance. Edits the
// display name shown everywhere in the app (independent of the Google account).
export function DisplayNameEditor({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = (() => {
    const raw = (name || "you").split(" ")[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  async function save() {
    const next = value.trim();
    if (!next) {
      setError("Name can’t be empty.");
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPatch("/api/me/name", { name: next });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your name.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <h1 className="serif-xl flex items-center gap-2">
        Hey {firstName} 👋
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setError(null);
            setEditing(true);
          }}
          aria-label="Edit your display name"
          title="Edit your name"
          className="rounded-full border border-[rgba(255,255,255,0.14)] px-2 py-0.5 text-xs text-ink-soft transition hover:border-accent hover:text-ink"
        >
          ✎
        </button>
      </h1>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={50}
          placeholder="Your name"
          className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-1.5 text-lg text-ink outline-none focus:border-accent"
        />
        <button onClick={save} disabled={busy} className="btn-primary px-3 py-1.5 text-sm">
          {busy ? "…" : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={busy}
          className="btn-ghost px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-[#e57373]">{error}</p>}
    </div>
  );
}
