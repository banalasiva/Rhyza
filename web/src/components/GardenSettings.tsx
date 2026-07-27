"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GardenSettings({
  garden,
}: {
  garden: {
    id: string;
    name: string;
    description: string | null;
    emoji: string;
    visibility: "public" | "private";
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(garden.name);
  const [emoji, setEmoji] = useState(garden.emoji);
  const [description, setDescription] = useState(garden.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(garden.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${garden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji, description, visibility }),
      });
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? "Failed to save");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${garden.name}" and everything in it? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gardens/${garden.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? "Failed to delete");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
        ⚙ Manage
      </button>
    );
  }

  return (
    <div className="card w-full p-4">
      <p className="eyebrow mb-3">Garden settings</p>

      {/* Labelled fields with room to read — the name on one clear line, and a
          description box tall enough to see the whole thing while editing. */}
      <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-soft">Name</label>
      <div className="mb-3 flex gap-2">
        <input
          className="input w-14 shrink-0 text-center"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={4}
          aria-label="Garden emoji"
        />
        <input
          className="input min-w-0 flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Garden name"
        />
      </div>

      <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-soft">
        About this garden
      </label>
      <textarea
        className="input mb-3 min-h-[110px] leading-relaxed"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        placeholder="What's this garden for?"
      />

      <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-soft">
        Who can see it
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVisibility("public")}
          className="rounded-full border px-3 py-1.5 text-xs transition"
          style={visChip(visibility === "public")}
        >
          🌍 Public
        </button>
        <button
          type="button"
          onClick={() => setVisibility("private")}
          className="rounded-full border px-3 py-1.5 text-xs transition"
          style={visChip(visibility === "private")}
        >
          🔒 Private
        </button>
      </div>
      <p className="mb-3 mt-1.5 text-[11px] text-ink-soft">
        {visibility === "private" ? "Only members can see this garden" : "Everyone in the org can see it"}
      </p>
      {error && <p className="mb-2 text-sm text-[#e57373]">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary px-4 py-1.5 text-xs" disabled={busy}>Save</button>
          <button onClick={() => setOpen(false)} className="btn-ghost px-4 py-1.5 text-xs">Cancel</button>
        </div>
        <button onClick={remove} className="text-xs text-[#e57373] hover:underline" disabled={busy}>
          Delete garden
        </button>
      </div>
    </div>
  );
}

function visChip(active: boolean): React.CSSProperties {
  return {
    borderColor: active ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.1)",
    color: active ? "#66BB6A" : "#A0A890",
    background: active ? "rgba(76,175,80,0.1)" : "transparent",
  };
}
