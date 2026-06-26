"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeedDetail } from "@/lib/services/seeds";
import { DIMENSIONS, STAGES, stageIndex, type DimensionKey } from "@/lib/constants";
import { apiPost } from "@/lib/client";
import { playNatureSound, setMuted } from "@/lib/sound";
import { PlantSvg } from "@/components/PlantSvg";
import { RichEditor } from "@/components/RichEditor";
import { InlineText } from "@/components/InlineText";

type ReactionType = { key: string; emoji: string; label: string };
type Contribution = SeedDetail["contributions"][number];

export function SeedRoom({
  seed,
  reactions,
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
  const [muted, setMutedState] = useState(false);
  const [glowing, setGlowing] = useState<Set<string>>(new Set());
  const [watchers, setWatchers] = useState(1);

  // Simulated watcher presence (true real-time presence is the phase-2 Ably layer).
  useEffect(() => {
    const base = 2 + (seed.id.charCodeAt(0) % 6);
    setWatchers(base);
    const t = setInterval(() => {
      setWatchers((w) => Math.max(1, Math.min(18, w + (Math.random() > 0.5 ? 1 : -1))));
    }, 4000);
    return () => clearInterval(t);
  }, [seed.id]);

  useEffect(() => setMuted(muted), [muted]);

  const totalVotes = distribution.reduce((n, d) => n + d.votes, 0);
  const stageIdx = stageIndex(stage);
  const stageMeta = STAGES[stageIdx];

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
        { ...c, reactionCounts: {}, myReactions: [], parentId: null, endorsementCount: 0, iEndorsed: false },
      ]);
      setDraft("");
      playNatureSound("drop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to contribute");
    } finally {
      setBusy(false);
    }
  }

  async function react(contributionId: string, key: string) {
    playNatureSound("chirp");
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
          myReactions: has ? c.myReactions.filter((k) => k !== key) : [...c.myReactions, key],
        };
      }),
    );
    try {
      await apiPost(`/api/contributions/${contributionId}/reactions`, { reactionKey: key });
    } catch {
      router.refresh();
    }
  }

  async function endorse(contributionId: string) {
    playNatureSound("chirp");
    setGlowing((g) => new Set(g).add(contributionId));
    setTimeout(() => setGlowing((g) => {
      const n = new Set(g);
      n.delete(contributionId);
      return n;
    }), 900);
    setContributions((prev) =>
      prev.map((c) => {
        if (c.id !== contributionId) return c;
        const has = c.iEndorsed;
        return { ...c, iEndorsed: !has, endorsementCount: c.endorsementCount + (has ? -1 : 1) };
      }),
    );
    try {
      await apiPost(`/api/contributions/${contributionId}/endorsements`);
    } catch {
      router.refresh();
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
        playNatureSound("bloom");
        setBlooming(true);
        setTimeout(() => router.push(`/blooms/${res.bloomId}`), 3200);
      } else {
        playNatureSound("wind");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setBusy(false);
    }
  }

  const dimContributions = contributions.filter((c) => c.dimension === activeDim);
  const isBloomed = stage === "bloomed";

  return (
    <div className="relative mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
      {blooming && <BloomCelebration title={seed.title} />}

      {/* Plant column */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card flex flex-col items-center p-4">
          <div className="aspect-square w-full max-w-[260px]">
            <PlantSvg stage={stageIdx} />
          </div>
          <p className="eyebrow mt-2">{stageMeta.emoji} {stageMeta.label}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
            <span>👁 {watchers} watching</span>
            <button
              onClick={() => setMutedState((m) => !m)}
              className="hover:text-ink"
              title={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      </aside>

      {/* Thread column */}
      <div>
        <h1 className="serif-xl mb-2">{seed.title}</h1>
        <p className="mb-4 text-xs text-ink-soft">Planted by {seed.author?.name || "someone"}</p>
        {seed.content && (
          <p className="card mb-6 p-4 text-sm text-ink-mid">{seed.content}</p>
        )}

        {/* Stage voting */}
        <div className="card mb-6 p-4">
          <p className="eyebrow mb-3">Where is this seed? ({totalVotes} votes)</p>
          <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
            {distribution.map((d) => (
              <div key={d.stage} title={`${d.stage}: ${d.pct}%`} style={{ width: `${d.pct}%` }} className="bg-accent/70" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s.key}
                onClick={() => vote(s.key)}
                disabled={busy || isBloomed}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  myVote === s.key ? "border-accent text-accent" : "border-[rgba(76,175,80,0.2)] text-ink-mid hover:text-ink"
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
                  activeDim === d.key ? "bg-accent/15 text-accent" : "text-ink-mid hover:text-ink"
                }`}
              >
                {d.emoji} {d.label}
                {count > 0 && <span className="ml-1 text-ink-soft">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Contributions */}
        <div className="space-y-3">
          {dimContributions.length === 0 && (
            <p className="text-sm text-ink-soft">
              No contributions in {DIMENSIONS.find((d) => d.key === activeDim)?.label} yet. Be the first.
            </p>
          )}
          {dimContributions.map((c) => (
            <div key={c.id} className={`card p-4 ${glowing.has(c.id) ? "endorsed-glow" : ""}`}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-ink-soft">{c.author?.name || "Someone"}</p>
                <button
                  onClick={() => endorse(c.id)}
                  title="Endorse this contribution"
                  className={`text-xs transition ${c.iEndorsed ? "text-bloom" : "text-ink-soft hover:text-ink"}`}
                >
                  ✦ {c.iEndorsed ? "Endorsed" : "Endorse"}
                  {c.endorsementCount > 0 && ` · ${c.endorsementCount}`}
                </button>
              </div>
              <div className="mb-3 text-sm text-ink">
                <InlineText text={c.text} />
              </div>
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
                        mine ? "border-accent text-accent" : "border-transparent text-ink-soft hover:text-ink"
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
        {!isBloomed && (
          <div className="card mt-5 p-4">
            <RichEditor
              value={draft}
              onChange={setDraft}
              placeholder={`Contribute to ${DIMENSIONS.find((d) => d.key === activeDim)?.label}…  (**bold**, *italic*, \`code\`)`}
              disabled={busy}
            />
            {error && <p className="mb-2 mt-2 text-sm text-[#e57373]">{error}</p>}
            <button onClick={contribute} className="btn-primary mt-2" disabled={busy || draft.trim().length === 0}>
              {busy ? "Sending…" : "Contribute"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BloomCelebration({ title }: { title: string }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * 360;
        const dist = 120 + Math.random() * 90;
        const rad = (angle * Math.PI) / 180;
        return {
          emoji: ["🌸", "🌼", "🍃", "✨"][i % 4],
          bx: `${Math.cos(rad) * dist}%`,
          by: `${Math.sin(rad) * dist}%`,
          delay: i * 0.04,
        };
      }),
    [],
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(20,10,0,0.85)] px-6 text-center backdrop-blur">
      <div className="pointer-events-none absolute inset-0">
        {leaves.map((l, i) => (
          <span
            key={i}
            className="leaf-particle"
            style={
              {
                animationDelay: `${l.delay}s`,
                ["--bx" as string]: l.bx,
                ["--by" as string]: l.by,
                ["--bx2" as string]: l.bx,
                ["--by2" as string]: l.by,
              } as React.CSSProperties
            }
          >
            {l.emoji}
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="mb-3 text-6xl">🌸</div>
        <p className="eyebrow mb-2 text-bloom">This seed has bloomed</p>
        <h2 className="serif-lg max-w-md">{title}</h2>
        <p className="mt-3 text-sm text-ink-mid">Taking you to the bloom…</p>
      </div>
    </div>
  );
}
