"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

// One-tap starting points so a newcomer never faces a blank form. Tuned for
// real, human groups — not just work teams.
const QUICK_STARTS: { emoji: string; name: string }[] = [
  { emoji: "🏡", name: "Home & family" },
  { emoji: "✈️", name: "A trip we're planning" },
  { emoji: "🤝", name: "Friends" },
  { emoji: "💼", name: "My team" },
];

export function CreateGardenForm({ firstRun = false }: { firstRun?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌱");
  const [description, setDescription] = useState("");
  // Private by default — families expect their space to be just theirs; they can
  // still flip a garden to Public to share it with the wider circle.
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiPost<{ id: string }>("/api/gardens", {
        name,
        emoji,
        description: description || undefined,
        visibility,
      });
      router.push(`/gardens/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {firstRun && (
        <div>
          <p className="mb-1.5 text-xs text-ink-soft">Quick start:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_STARTS.map((q) => (
              <button
                key={q.name}
                type="button"
                onClick={() => {
                  setEmoji(q.emoji);
                  setName(q.name);
                }}
                className="rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs text-ink-mid transition hover:border-[rgba(76,175,80,0.4)] hover:text-ink"
              >
                {q.emoji} {q.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="input w-16 text-center"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={4}
          aria-label="Garden emoji"
        />
        <input
          className="input flex-1"
          placeholder={firstRun ? "Name your garden — e.g. Home & family" : "Garden name — e.g. Product decisions"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </div>
      <textarea
        className="input min-h-[60px]"
        placeholder="What does this garden explore? (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVisibility("public")}
          title="Anyone in your org can see and join"
          className="rounded-full border px-3 py-1.5 text-xs transition"
          style={chip(visibility === "public")}
        >
          🌍 Public
        </button>
        <button
          type="button"
          onClick={() => setVisibility("private")}
          title="Only members you add can see it"
          className="rounded-full border px-3 py-1.5 text-xs transition"
          style={chip(visibility === "private")}
        >
          🔒 Private
        </button>
      </div>
      {error && <p className="text-sm text-[#e57373]">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy || name.trim().length < 2}>
        {busy ? "Planting…" : firstRun ? "Create my garden →" : "Create garden"}
      </button>
    </form>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    borderColor: active ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.1)",
    color: active ? "#66BB6A" : "#A0A890",
    background: active ? "rgba(76,175,80,0.1)" : "transparent",
  };
}
