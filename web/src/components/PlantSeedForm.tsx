"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

export function PlantSeedForm({ gardenId }: { gardenId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiPost<{ id: string }>(
        `/api/gardens/${gardenId}/seeds`,
        { title, content: content || undefined },
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
      {error && <p className="text-sm text-[#e57373]">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy || title.trim().length < 4}>
        {busy ? "Planting…" : "🌱 Plant seed"}
      </button>
    </form>
  );
}
