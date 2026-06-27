"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

export function CreateGardenForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌱");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
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
          placeholder="Garden name — e.g. Distributed Systems"
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
        {busy ? "Planting…" : "Create garden"}
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
