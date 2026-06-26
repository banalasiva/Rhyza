"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeedDetail } from "@/lib/services/seeds";
import {
  DIMENSIONS,
  STAGES,
  stageIndex,
  BLOOM_MIN_VOTERS,
  BLOOM_VOTE_THRESHOLD_PCT,
  type DimensionKey,
} from "@/lib/constants";
import { apiPost } from "@/lib/client";
import { playNatureSound, setMuted } from "@/lib/sound";
import { timeAgo } from "@/lib/time";
import { PlantSvg } from "@/components/PlantSvg";
import { RichEditor } from "@/components/RichEditor";
import { InlineText } from "@/components/InlineText";
import { Avatar } from "@/components/Avatar";

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
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => setMuted(muted), [muted]);

  // Simulated presence (real-time presence is the phase-2 Ably layer).
  useEffect(() => {
    setWatchers(2 + (seed.id.charCodeAt(0) % 6));
    const t = setInterval(() => {
      setWatchers((w) => Math.max(1, Math.min(18, w + (Math.random() > 0.5 ? 1 : -1))));
      setReviewing(Math.random() > 0.6);
    }, 5000);
    return () => clearInterval(t);
  }, [seed.id]);

  const isBloomed = stage === "bloomed";
  const stageIdx = stageIndex(stage);
  const stageMeta = STAGES[stageIdx];
  const totalVotes = distribution.reduce((n, d) => n + d.votes, 0);

  const participants = useMemo(() => {
    const ids = new Set<string>();
    if (seed.author?.id) ids.add(seed.author.id);
    for (const c of contributions) if (c.author?.id) ids.add(c.author.id);
    return Math.max(ids.size, 1);
  }, [contributions, seed.author]);

  const dimsWithContribs = useMemo(
    () => new Set(contributions.map((c) => c.dimension)).size,
    [contributions],
  );

  const bloomedVotes = distribution.find((d) => d.stage === "bloomed")?.votes ?? 0;
  const bloomTarget = Math.max(
    BLOOM_MIN_VOTERS,
    Math.ceil((totalVotes || 1) * (BLOOM_VOTE_THRESHOLD_PCT / 100)),
  );
  const bloomNeeded = Math.max(0, bloomTarget - bloomedVotes);
  const bloomReady = bloomedVotes >= bloomTarget && dimsWithContribs >= 3;

  // Convergence signal from the debate ratio.
  const convergence = useMemo(() => {
    const total = contributions.length;
    const debate = contributions.filter((c) => c.dimension === "debate").length;
    const ratio = total === 0 ? 0 : debate / total;
    if (total >= 3 && ratio < 0.25) return { label: "Converging", color: "#66BB6A", note: "Community is aligning on core understanding" };
    if (ratio > 0.4) return { label: "Diverging", color: "#EF9A9A", note: "Healthy debate — perspectives still forming" };
    return { label: "Building", color: "#FFB300", note: "Understanding is taking shape" };
  }, [contributions]);

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
    // Update the UI first so the click feels instant, then play the sound.
    setContributions((prev) =>
      prev.map((c) => {
        if (c.id !== contributionId) return c;
        const has = c.myReactions.includes(key);
        const counts = { ...c.reactionCounts };
        counts[key] = (counts[key] ?? 0) + (has ? -1 : 1);
        if (counts[key] <= 0) delete counts[key];
        return { ...c, reactionCounts: counts, myReactions: has ? c.myReactions.filter((k) => k !== key) : [...c.myReactions, key] };
      }),
    );
    playNatureSound("chirp");
    try {
      await apiPost(`/api/contributions/${contributionId}/reactions`, { reactionKey: key });
    } catch {
      router.refresh();
    }
  }

  async function endorse(contributionId: string) {
    setGlowing((g) => new Set(g).add(contributionId));
    setTimeout(() => setGlowing((g) => { const n = new Set(g); n.delete(contributionId); return n; }), 900);
    setContributions((prev) =>
      prev.map((c) => (c.id === contributionId ? { ...c, iEndorsed: !c.iEndorsed, endorsementCount: c.endorsementCount + (c.iEndorsed ? -1 : 1) } : c)),
    );
    playNatureSound("chirp");
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
      const res = await apiPost<{ distribution: typeof distribution; stage: string; bloomed: boolean; bloomId: string | null }>(
        `/api/seeds/${seed.id}/stage-votes`,
        { stage: targetStage },
      );
      setDistribution(res.distribution);
      setMyVote(targetStage);
      setStage(res.stage);
      if (res.bloomed && res.bloomId) {
        playNatureSound("bloom");
        setStage("bloomed");
        setBlooming(true);
        // The celebration plays, then we glide to the Sacred Tree where the new
        // bloom now lives.
        setTimeout(() => router.push(`/gardens/${seed.garden.id}/tree`), 4200);
      } else {
        playNatureSound("wind");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setBusy(false);
    }
  }

  const dimMeta = DIMENSIONS.find((d) => d.key === activeDim)!;
  const dimContributions = contributions.filter((c) => c.dimension === activeDim);

  return (
    <div className="relative mt-3 grid gap-6 lg:grid-cols-[1fr_360px]">
      {blooming && <BloomCelebration title={seed.title} />}

      {/* ── Thread column ── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="eyebrow">
            🌱 Seed · by {seed.author?.name || "someone"} · {participants} participant{participants === 1 ? "" : "s"}
          </p>
          {reviewing && !isBloomed && (
            <span className="rounded-full border border-[rgba(76,175,80,0.3)] px-3 py-1 text-xs text-accent">
              🌱 Someone is reviewing this seed…
            </span>
          )}
        </div>
        <h1 className="serif-xl mb-4">{seed.title}</h1>
        {seed.content && <p className="card mb-5 p-4 text-sm text-ink-mid">{seed.content}</p>}

        {/* Dimension tabs */}
        <div className="mb-4 flex flex-wrap gap-2 border-b border-[rgba(76,175,80,0.12)] pb-3">
          {DIMENSIONS.map((d) => {
            const count = contributions.filter((c) => c.dimension === d.key).length;
            const active = activeDim === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setActiveDim(d.key)}
                className="rounded-full px-3 py-1.5 text-sm transition"
                style={{
                  color: active ? d.color : "#A0A890",
                  background: active ? `${d.color}22` : "transparent",
                }}
              >
                {d.emoji} {d.label}
                {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Dimension explainer */}
        <div className="mb-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-base">{dimMeta.emoji}</span>
            <span className="font-medium" style={{ color: dimMeta.color }}>
              What is {dimMeta.label}?
            </span>
            <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs text-ink-soft">
              {dimContributions.length} contribution{dimContributions.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-sm text-ink-soft">{dimMeta.description}</p>
        </div>

        {/* Contributions */}
        <div className="space-y-3">
          {dimContributions.length === 0 && (
            <p className="text-sm text-ink-soft">No contributions here yet. Be the first.</p>
          )}
          {dimContributions.map((c) => {
            const cd = DIMENSIONS.find((d) => d.key === c.dimension)!;
            return (
              <div key={c.id} className={`card p-4 ${glowing.has(c.id) ? "endorsed-glow" : ""}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={c.author?.name} image={c.author?.image} size={32} />
                    <div>
                      <p className="text-sm font-medium text-ink">{c.author?.name || "Someone"}</p>
                      <p className="text-xs text-ink-soft">{timeAgo(c.createdAt)}</p>
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ color: cd.color, background: `${cd.color}1A` }}>
                    {cd.emoji} {cd.label}
                  </span>
                </div>
                <div className="mb-3 text-sm leading-relaxed text-ink">
                  <InlineText text={c.text} />
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {reactions.map((r) => {
                    const n = c.reactionCounts[r.key] ?? 0;
                    const mine = c.myReactions.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        onClick={() => react(c.id, r.key)}
                        title={r.label}
                        className={`rounded-full border px-2 py-0.5 text-xs transition ${
                          mine ? "border-accent text-accent" : "border-[rgba(255,255,255,0.08)] text-ink-soft hover:text-ink"
                        }`}
                      >
                        {r.emoji} {n > 0 && n}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-soft">
                  <button onClick={() => endorse(c.id)} className={`transition ${c.iEndorsed ? "text-bloom" : "hover:text-ink"}`}>
                    ✦ {c.iEndorsed ? "Endorsed" : "Endorse"}
                    {c.endorsementCount > 0 && ` · ${c.endorsementCount}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compose */}
        {!isBloomed && (
          <div className="card mt-6 p-5">
            <p className="eyebrow mb-3" style={{ color: dimMeta.color }}>
              {dimMeta.emoji} Add to {dimMeta.label}
            </p>
            <RichEditor
              value={draft}
              onChange={setDraft}
              placeholder={`${dimMeta.blurb}  (**bold**, *italic*, \`code\`)`}
              disabled={busy}
            />
            {error && <p className="mb-2 mt-2 text-sm text-[#e57373]">{error}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-ink-soft">{draft.length}/5000</span>
              <button onClick={contribute} className="btn-primary" disabled={busy || draft.trim().length === 0}>
                {busy ? "Sending…" : "Contribute"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right rail ── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          {/* Plant */}
          <div className="relative bg-[rgba(7,13,7,0.5)] p-3">
            <div className="mx-auto aspect-square w-full max-w-[230px]">
              <PlantSvg stage={stageIdx} />
            </div>
            <button
              onClick={() => setMutedState((m) => !m)}
              className="absolute right-3 top-3 text-sm text-ink-soft hover:text-ink"
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>

          <div className="p-4">
            {/* Stage status */}
            <div className="mb-4 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs" style={{ color: isBloomed ? "#FFB300" : "#66BB6A" }}>
                {stageMeta.emoji} {stageMeta.label}
              </span>
            </div>

            {/* Community feels */}
            <p className="eyebrow mb-3">
              Community feels · <span className="text-ink-soft">{totalVotes}/{participants}</span>
            </p>
            <div className="space-y-2">
              {STAGES.map((s) => {
                const d = distribution.find((x) => x.stage === s.key)!;
                const mine = myVote === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => vote(s.key)}
                    disabled={busy || isBloomed}
                    className="block w-full rounded-xl border p-2 text-left transition disabled:cursor-default"
                    style={{ borderColor: mine ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.06)" }}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span style={{ color: mine ? "#66BB6A" : "#C8C4BC" }}>{s.emoji} {s.label}</span>
                      <span className="text-ink-soft">{d.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                      <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: s.key === "bloomed" ? "linear-gradient(to right,#FFD54F,#FF8F00)" : "#4CAF50", transition: "width 0.6s" }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {myVote === null && !isBloomed && (
              <p className="mt-2 text-center text-xs italic text-ink-soft">Tap a stage to vote → watch the plant respond</p>
            )}

            {/* Convergence */}
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[rgba(255,255,255,0.03)] p-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: convergence.color, boxShadow: `0 0 6px ${convergence.color}` }} />
              <div>
                <p className="text-xs font-medium" style={{ color: convergence.color }}>{convergence.label}</p>
                <p className="text-[11px] text-ink-soft">{convergence.note}</p>
              </div>
            </div>

            {/* Bloom high bar */}
            <div
              className="mt-4 rounded-2xl border p-3"
              style={{ borderColor: bloomReady ? "rgba(255,179,0,0.4)" : "rgba(255,255,255,0.07)", background: bloomReady ? "rgba(255,179,0,0.08)" : "rgba(255,255,255,0.03)" }}
            >
              <div className="mb-2 flex items-center gap-1.5 text-xs text-ink-soft">
                👁 {watchers} watching
                <span className="h-1.5 w-1.5 rounded-full bg-accent" style={{ boxShadow: "0 0 5px #4CAF50" }} />
              </div>
              <p className="eyebrow mb-2" style={{ color: bloomReady ? "#FFB300" : "#5A6456" }}>🌸 Bloom · High bar</p>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (bloomedVotes / bloomTarget) * 100)}%`, background: bloomReady ? "linear-gradient(to right,#FFD54F,#FF8F00)" : "rgba(255,179,0,0.4)", transition: "width 0.7s" }} />
              </div>
              <p className="mb-3 text-[11px]" style={{ color: bloomReady ? "#FFB300" : "#5A6456" }}>
                {isBloomed
                  ? "🌸 Bloomed — collective knowledge, remembered."
                  : bloomReady
                    ? `🌸 Ready to bloom! ${bloomedVotes}/${bloomTarget} voted.`
                    : `${bloomedVotes}/${bloomTarget} bloom votes (${bloomNeeded} more)`}
              </p>
              <Requirement met={bloomedVotes >= bloomTarget} label={`${bloomedVotes}/${bloomTarget} voted Bloom`} />
              <Requirement met={dimsWithContribs >= 3} label={`${dimsWithContribs}/3 dimensions have contributions`} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] text-white"
        style={{ background: met ? "#4CAF50" : "rgba(255,255,255,0.1)" }}
      >
        {met ? "✓" : ""}
      </span>
      <span className="text-[11px]" style={{ color: met ? "#66BB6A" : "#4A5848" }}>{label}</span>
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
        return { emoji: ["🌸", "🌼", "🍃", "✨"][i % 4], bx: `${Math.cos(rad) * dist}%`, by: `${Math.sin(rad) * dist}%`, delay: i * 0.04 };
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
            style={{ animationDelay: `${l.delay}s`, ["--bx" as string]: l.bx, ["--by" as string]: l.by, ["--bx2" as string]: l.bx, ["--by2" as string]: l.by } as React.CSSProperties}
          >
            {l.emoji}
          </span>
        ))}
      </div>
      <div className="relative animate-[fadeUp_0.8s_ease-out]">
        <div className="mx-auto mb-2 h-40 w-40">
          <PlantSvg stage={4} />
        </div>
        <p className="eyebrow mb-2 text-bloom">This seed has bloomed</p>
        <h2 className="serif-lg mx-auto max-w-md">{title}</h2>
        <p className="mt-3 text-sm text-ink-mid">
          Collective knowledge, forever remembered — taking you to the Sacred Tree…
        </p>
      </div>
    </div>
  );
}
