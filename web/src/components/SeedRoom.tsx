"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeedDetail } from "@/lib/services/seeds";
import { DIMENSIONS, STAGES, type DimensionKey } from "@/lib/constants";
import { apiPost } from "@/lib/client";

type ReactionType = { key: string; emoji: string; label: string };

type Contribution = SeedDetail["contributions"][number];

export function SeedRoom({
  seed,
  reactions,
  currentUserId,
}: {
  seed: SeedDetail;
  reactions: ReactionType[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>(seed.contributions);
  const [distribution, setDistribution] = useState(seed.distribution);
  const [myVote, setMyVote] = useState<string | null>(seed.myVote);
  const [stage, setStage] = useState<string>(seed.stage);
  const [activeDim, setActiveDim] = useState<DimensionKey>(DIMENSIONS[0].key);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blooming, setBlooming] = useState(false);

  const totalVotes = distribution.reduce((n, d) => n + d.votes, 0);
  const stageMeta = STAGES.find((s) => s.key === stage) ?? STAGES[0];

  async function contribute() {
    if (draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const c = await apiPost<Contribution>(`/api/seeds/${seed.id}/contributions`, {
        dimension: activeDim,
        text: draft.trim(),
      });
      setContributions((prev) => [
        ...prev,
        { ...c, reactionCounts: {}, myReactions: [], parentId: null },
      ]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to contribute");
    } finally {
      setBusy(false);
    }
  }

  async function react(contributionId: string, key: string) {
    // optimistic toggle
    setContributions((prev) =>
      prev.map((c) => {
        if (c.id !== contributionId) return c;
        const has = c.myReactions.includes(key);
        const counts = { ...c.reactionCounts };
        counts[key] = (counts[key] ?? 0) + (has ? -1 : 1);
        if (counts[key] <= 0) delete counts[key];
        return {
          ...c,
          reactionCounts: counts,
          myReactions: has
            ? c.myReactions.filter((k) => k !== key)
            : [...c.myReactions, key],
        };
      }),
    );
    try {
      await apiPost(`/api/contributions/${contributionId}/reactions`, {
        reactionKey: key,
      });
    } catch {
      router.refresh(); // reconcile on failure
    }
  }

  async function vote(targetStage: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{
        distribution: typeof distribution;
        stage: string;
        bloomed: boolean;
        bloomId: string | null;
      }>(`/api/seeds/${seed.id}/stage-votes`, { stage: targetStage });
      setDistribution(res.distribution);
      setMyVote(targetStage);
      setStage(res.stage);
      if (res.bloomed && res.bloomId) {
        setBlooming(true);
        setTimeout(() => router.push(`/blooms/${res.bloomId}`), 2600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setBusy(false);
    }
  }

  const dimContributions = contributions.filter((c) => c.dimension === activeDim);

  return (
    <div className="relative mt-4">
      {blooming && <BloomOverlay title={seed.title} />}

      <p className="eyebrow mb-1">{stageMeta.emoji} {stageMeta.label}</p>
      <h1 className="serif-xl mb-2">{seed.title}</h1>
      <p className="mb-4 text-xs text-ink-soft">
        Planted by {seed.author?.name || "someone"}
      </p>
      {seed.content && (
        <p className="card mb-6 p-4 text-sm text-ink-mid">{seed.content}</p>
      )}

      {/* Stage voting */}
      <div className="card mb-6 p-4">
        <p className="eyebrow mb-3">Where is this seed? ({totalVotes} votes)</p>
        <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
          {distribution.map((d) => (
            <div
              key={d.stage}
              title={`${d.stage}: ${d.pct}%`}
              style={{ width: `${d.pct}%` }}
              className="bg-accent/70"
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => vote(s.key)}
              disabled={busy || stage === "bloomed"}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                myVote === s.key
                  ? "border-accent text-accent"
                  : "border-[rgba(76,175,80,0.2)] text-ink-mid hover:text-ink"
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimension tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {DIMENSIONS.map((d) => {
          const count = contributions.filter((c) => c.dimension === d.key).length;
          return (
            <button
              key={d.key}
              onClick={() => setActiveDim(d.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                activeDim === d.key
                  ? "bg-accent/15 text-accent"
                  : "text-ink-mid hover:text-ink"
              }`}
            >
              {d.emoji} {d.label}
              {count > 0 && <span className="ml-1 text-ink-soft">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Contributions for the active dimension */}
      <div className="space-y-3">
        {dimContributions.length === 0 && (
          <p className="text-sm text-ink-soft">
            No contributions in {DIMENSIONS.find((d) => d.key === activeDim)?.label} yet.
            Be the first.
          </p>
        )}
        {dimContributions.map((c) => (
          <div key={c.id} className="card p-4">
            <p className="mb-1 text-xs text-ink-soft">{c.author?.name || "Someone"}</p>
            <p className="mb-3 text-sm text-ink">{c.text}</p>
            <div className="flex flex-wrap gap-1.5">
              {reactions.map((r) => {
                const n = c.reactionCounts[r.key] ?? 0;
                const mine = c.myReactions.includes(r.key);
                return (
                  <button
                    key={r.key}
                    onClick={() => react(c.id, r.key)}
                    title={r.label}
                    className={`rounded-full border px-2 py-0.5 text-xs transition ${
                      mine
                        ? "border-accent text-accent"
                        : "border-transparent text-ink-soft hover:text-ink"
                    }`}
                  >
                    {r.emoji} {n > 0 && n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Compose */}
      {stage !== "bloomed" && (
        <div className="card mt-5 p-4">
          <textarea
            className="input mb-2 min-h-[70px]"
            placeholder={`Contribute to ${
              DIMENSIONS.find((d) => d.key === activeDim)?.label
            }…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={5000}
          />
          {error && <p className="mb-2 text-sm text-[#e57373]">{error}</p>}
          <button
            onClick={contribute}
            className="btn-primary"
            disabled={busy || draft.trim().length === 0}
          >
            {busy ? "Sending…" : "Contribute"}
          </button>
        </div>
      )}
    </div>
  );
}

function BloomOverlay({ title }: { title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 text-center backdrop-blur">
      <div>
        <div className="mb-3 text-6xl">🌸</div>
        <p className="eyebrow mb-2" style={{ color: "#FFB300" }}>
          This seed has bloomed
        </p>
        <h2 className="serif-lg max-w-md">{title}</h2>
        <p className="mt-3 text-sm text-ink-mid">Taking you to the bloom…</p>
      </div>
    </div>
  );
}
