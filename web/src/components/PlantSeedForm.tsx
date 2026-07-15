"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";
import { track } from "@/lib/analytics";

type GardenNode = { id: string; name: string; emoji: string };

export function PlantSeedForm({ gardenId }: { gardenId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which garden this seed goes into — shown and changeable, so a seed never
  // silently lands in the wrong space (the "soccer went into networking" bug).
  const [gardens, setGardens] = useState<GardenNode[] | null>(null);
  const [garden, setGarden] = useState(gardenId);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me/tree", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setGardens((json?.gardens ?? json?.data?.gardens ?? []) as GardenNode[]))
      .catch(() => setGardens([]));
  }, []);

  const current = gardens?.find((g) => g.id === garden);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiPost<{ id: string }>(`/api/gardens/${garden}/seeds`, {
        title,
        visibility,
      });
      track("seed_planted", { visibility });
      router.push(`/seeds/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Planting-in selector — always visible so the target garden is obvious */}
      <div className="relative">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-soft">Planting in</p>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="flex w-full items-center gap-2 rounded-xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.06)] px-3 py-2 text-left transition hover:border-accent"
        >
          <span aria-hidden className="text-base">{current?.emoji ?? "🌿"}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {current?.name ?? "this garden"}
          </span>
          {gardens && gardens.length > 1 && (
            <span className="shrink-0 text-xs text-ink-soft">Change ▾</span>
          )}
        </button>
        {pickerOpen && gardens && gardens.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[rgba(76,175,80,0.25)] bg-[#0B120B] p-1 shadow-xl">
            {gardens.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGarden(g.id);
                  setPickerOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5 ${
                  g.id === garden ? "text-accent" : "text-ink"
                }`}
              >
                <span aria-hidden>{g.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                {g.id === garden && <span className="shrink-0 text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        className="input"
        placeholder="Ask a question — e.g. “Where should we go this holiday?”"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
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
        {busy ? "Planting…" : "🌱 Plant it — and let's begin"}
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
