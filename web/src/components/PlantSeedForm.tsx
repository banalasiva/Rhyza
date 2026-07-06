"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

export function PlantSeedForm({ gardenId }: { gardenId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiPost<{ id: string }>(
        `/api/gardens/${gardenId}/seeds`,
        { title, content: content || undefined, visibility },
      );
      router.push(`/seeds/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className="input"
        placeholder="Ask a question worth exploring…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <textarea
        className="input min-h-[70px]"
        placeholder="Add context (optional)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
      />
      <div className="flex items-center gap-2">
        <VisChip
          active={visibility === "public"}
          onClick={() => setVisibility("public")}
          label="🌍 Public"
          hint="Anyone in the garden can see and join"
        />
        <VisChip
          active={visibility === "private"}
          onClick={() => setVisibility("private")}
          label="🔒 Private"
          hint="Only people you invite can see it"
        />
      </div>
      {error && <p className="text-sm text-[#e57373]">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy || title.trim().length < 4}>
        {busy ? "Planting…" : "🌱 Plant seed"}
      </button>
    </form>
  );
}

function VisChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="rounded-full border px-3 py-1.5 text-xs transition"
      style={{
        borderColor: active ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.1)",
        color: active ? "#66BB6A" : "#A0A890",
        background: active ? "rgba(76,175,80,0.1)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}
