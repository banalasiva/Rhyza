"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeedDetail } from "@/lib/services/seeds";
import {
  DIMENSIONS,
  STAGES,
  stageIndex,
  bloomTargetFor,
  type DimensionKey,
} from "@/lib/constants";
import { apiPost } from "@/lib/client";
import { playNatureSound, setMuted } from "@/lib/sound";
import { timeAgo } from "@/lib/time";
import { upload } from "@vercel/blob/client";
import { PlantSvg } from "@/components/PlantSvg";
import { HowItWorks } from "@/components/HowItWorks";
import { RichEditor } from "@/components/RichEditor";
import { InlineText } from "@/components/InlineText";
import { Avatar } from "@/components/Avatar";
import { Attachments, type Attachment } from "@/components/Attachments";

type ReactionType = { key: string; emoji: string; label: string };
type Contribution = SeedDetail["contributions"][number];

type ContributionResponse = {
  id: string;
  dimension: string;
  text: string;
  attachments?: Attachment[];
  parentId: string | null;
  author: Contribution["author"];
  createdAt: string;
  aiReply?: Omit<ContributionResponse, "aiReply" | "aiError"> | null;
  aiError?: string | null;
};

// Turn a bare API contribution into a full client-side Contribution (with the
// reaction/endorsement fields the UI tracks locally).
function hydrate(c: Omit<ContributionResponse, "aiReply">): Contribution {
  return {
    id: c.id,
    dimension: c.dimension,
    text: c.text,
    attachments: c.attachments ?? [],
    parentId: c.parentId ?? null,
    author: c.author,
    createdAt: c.createdAt,
    reactionCounts: {},
    myReactions: [],
    endorsementCount: 0,
    iEndorsed: false,
  };
}

function attachmentType(mime: string): Attachment["type"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export function SeedRoom({
  seed,
  reactions,
  currentUserId,
  uploadsEnabled = false,
}: {
  seed: SeedDetail;
  reactions: ReactionType[];
  currentUserId: string;
  uploadsEnabled?: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [contributions, setContributions] = useState<Contribution[]>(seed.contributions);
  const [distribution, setDistribution] = useState(seed.distribution);
  const [myVote, setMyVote] = useState<string | null>(seed.myVote);
  const [stage, setStage] = useState<string>(seed.stage);
  const [filterDim, setFilterDim] = useState<DimensionKey | null>(null); // null = All
  const [evolveDismissed, setEvolveDismissed] = useState(false);
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  const [retagId, setRetagId] = useState<string | null>(null); // open re-tag menu
  const [draft, setDraft] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blooming, setBlooming] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [glowing, setGlowing] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState(false);
  const [mediating, setMediating] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">(seed.visibility);
  const [visBusy, setVisBusy] = useState(false);
  const [bloomConfirm, setBloomConfirm] = useState(false); // confirm modal open
  const [previewBloom, setPreviewBloom] = useState(false); // flower the plant as a preview
  const [bursts, setBursts] = useState<
    { id: number; emoji: string; x: number; y: number; dx: number }[]
  >([]);
  const [labelFx, setLabelFx] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const burstId = useRef(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => setMuted(muted), [muted]);

  // Show the walkthrough automatically the first time someone opens a seed.
  useEffect(() => {
    try {
      if (!localStorage.getItem("rhyza_seen_intro")) {
        setShowHelp(true);
        localStorage.setItem("rhyza_seen_intro", "1");
      }
    } catch {
      /* localStorage unavailable — skip */
    }
  }, []);

  // Live bloom: while the seed is still open, poll its status so that when
  // *anyone* tips it over, the celebration fires on everyone's screen — not just
  // the person who cast the deciding vote.
  useEffect(() => {
    if (stage === "bloomed" || blooming) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/seeds/${seed.id}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data?.stage === "bloomed") triggerBloom();
      } catch {
        /* transient — keep polling */
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, blooming, seed.id]);

  const isBloomed = stage === "bloomed";
  const stageIdx = stageIndex(stage);
  const stageMeta = STAGES[stageIdx];
  // The viewer voted to bloom but it hasn't bloomed yet → they're now a viewer.
  const committedToBloom = myVote === "bloomed" && !isBloomed;
  // Preview (or a committed vote) flowers the plant; otherwise follow real stage.
  const plantStage = previewBloom || isBloomed ? 4 : stageIdx;
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
  const bloomTarget = bloomTargetFor(participants);
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

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        setDraftAttachments((prev) => [
          ...prev,
          { url: blob.url, type: attachmentType(file.type), name: file.name },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function contribute() {
    const text = draft.trim();
    if (text.length === 0 && draftAttachments.length === 0) return;
    setBusy(true);
    setError(null);
    const tagsClaude = /(^|[^a-zA-Z0-9])@claude\b/i.test(text);
    try {
      // If Claude is tagged, show a "thinking" placeholder while it replies.
      if (tagsClaude) setThinking(true);
      // No dimension sent — people just write; Claude labels it after posting.
      const c = await apiPost<ContributionResponse>(`/api/seeds/${seed.id}/contributions`, {
        text,
        attachments: draftAttachments,
      });
      setContributions((prev) => {
        const next = [...prev, hydrate(c)];
        if (c.aiReply) next.push(hydrate(c.aiReply));
        return next;
      });
      setDraft("");
      setDraftAttachments([]);
      playNatureSound(c.aiReply ? "chirp" : "drop");
      if (tagsClaude && !c.aiReply) {
        setError(
          c.aiError === "not_configured"
            ? "Claude isn't configured — add ANTHROPIC_API_KEY in Vercel and redeploy."
            : `Claude couldn't reply: ${c.aiError ?? "unknown error"}`,
        );
      }
      // Let Claude label the dimension in the background; the badge fills in.
      classify(c.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to contribute");
    } finally {
      setThinking(false);
      setBusy(false);
    }
  }

  async function classify(contributionId: string) {
    setClassifyingIds((s) => new Set(s).add(contributionId));
    try {
      const res = await apiPost<{ dimension: string }>(
        `/api/contributions/${contributionId}/classify`,
        {},
      );
      setContributions((prev) =>
        prev.map((c) => (c.id === contributionId ? { ...c, dimension: res.dimension } : c)),
      );
    } catch {
      /* leave the provisional label */
    } finally {
      setClassifyingIds((s) => {
        const n = new Set(s);
        n.delete(contributionId);
        return n;
      });
    }
  }

  async function retag(contributionId: string, dimension: DimensionKey) {
    setRetagId(null);
    setContributions((prev) =>
      prev.map((c) => (c.id === contributionId ? { ...c, dimension } : c)),
    );
    try {
      await fetch(`/api/contributions/${contributionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension }),
      });
    } catch {
      router.refresh();
    }
  }

  async function askMediate() {
    setMediating(true);
    setError(null);
    try {
      const c = await apiPost<ContributionResponse>(`/api/seeds/${seed.id}/mediate`, {});
      setContributions((prev) => [...prev, hydrate(c)]);
      setFilterDim(null); // show the full thread so the mediation is visible
      playNatureSound("chirp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mediation failed");
    } finally {
      setMediating(false);
    }
  }

  async function toggleVisibility() {
    const next = visibility === "private" ? "public" : "private";
    setVisBusy(true);
    setError(null);
    const prev = visibility;
    setVisibility(next); // optimistic
    try {
      const res = await fetch(`/api/seeds/${seed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        setVisibility(prev);
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Couldn't change visibility");
      }
    } catch {
      setVisibility(prev);
    } finally {
      setVisBusy(false);
    }
  }

  function spawnBurst(emoji: string, x: number, y: number) {
    const id = ++burstId.current;
    // A few emojis fan out for a little celebratory pop.
    const particles = Array.from({ length: 5 }).map((_, i) => ({
      id: id * 100 + i,
      emoji,
      x,
      y,
      dx: (i - 2) * 16 + (Math.random() * 8 - 4),
    }));
    setBursts((b) => [...b, ...particles]);
    setTimeout(() => setBursts((b) => b.filter((p) => Math.floor(p.id / 100) !== id)), 900);
  }

  function spawnLabel(text: string, x: number, y: number) {
    const id = ++burstId.current;
    setLabelFx((prev) => [...prev, { id, text, x, y }]);
    setTimeout(() => setLabelFx((prev) => prev.filter((l) => l.id !== id)), 1200);
  }

  async function react(contributionId: string, key: string, el?: HTMLElement) {
    const current = contributions.find((c) => c.id === contributionId);
    const willAdd = current ? !current.myReactions.includes(key) : true;
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
    // Celebrate the click AND show what the reaction means (only when adding).
    if (willAdd && el) {
      const r = reactions.find((x) => x.key === key);
      const rect = el.getBoundingClientRect();
      spawnBurst(r?.emoji ?? "✨", rect.left + rect.width / 2, rect.top);
      spawnLabel(`${r?.emoji ?? ""} ${r?.label ?? ""}`.trim(), rect.left + rect.width / 2, rect.top);
    }
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

  async function saveEdit(id: string) {
    const text = editDraft.trim();
    if (!text) return;
    setContributions((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
    setEditingId(null);
    try {
      const res = await fetch(`/api/contributions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) router.refresh();
    } catch {
      router.refresh();
    }
  }

  async function removeContribution(id: string) {
    if (!confirm("Delete this contribution?")) return;
    setContributions((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/contributions/${id}`, { method: "DELETE" });
    } catch {
      router.refresh();
    }
  }

  async function bloomNow() {
    if (!confirm("Bloom this seed now? This creates a permanent bloom.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/seeds/${seed.id}/bloom`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to bloom");
      triggerBloom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bloom");
      setBusy(false);
    }
  }

  async function removeSeed() {
    if (!confirm("Delete this seed and its discussion? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/seeds/${seed.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Failed to delete");
      }
      router.push(`/gardens/${seed.garden.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  }

  // Clicking "Bloomed" is a commitment, so we preview the flowering and ask to
  // confirm before casting. Other stages vote immediately.
  function vote(targetStage: string) {
    if (isBloomed || busy) return;
    if (targetStage === "bloomed" && myVote !== "bloomed") {
      setError(null);
      setPreviewBloom(true); // flower the plant as a preview
      playNatureSound("bloom");
      setBloomConfirm(true);
      return;
    }
    castVote(targetStage);
  }

  function cancelBloom() {
    setBloomConfirm(false);
    setPreviewBloom(false); // revert the plant to its real stage
  }

  function confirmBloom() {
    setBloomConfirm(false);
    castVote("bloomed");
  }

  async function castVote(targetStage: string) {
    if (isBloomed) return;
    setError(null);

    // Optimistic: move the bars immediately so the click feels instant.
    const prevVote = myVote;
    if (prevVote !== targetStage) {
      setDistribution((prev) => {
        const counts: Record<string, number> = {};
        for (const d of prev) counts[d.stage] = d.votes;
        if (prevVote) counts[prevVote] = Math.max(0, (counts[prevVote] ?? 0) - 1);
        counts[targetStage] = (counts[targetStage] ?? 0) + 1;
        const total = Object.values(counts).reduce((n, v) => n + v, 0) || 1;
        return prev.map((d) => ({ ...d, votes: counts[d.stage] ?? 0, pct: Math.round(((counts[d.stage] ?? 0) / total) * 100) }));
      });
      setMyVote(targetStage);
    }
    playNatureSound("wind");

    try {
      const res = await apiPost<{ distribution: typeof distribution; stage: string; bloomed: boolean; bloomId: string | null }>(
        `/api/seeds/${seed.id}/stage-votes`,
        { stage: targetStage },
      );
      setDistribution(res.distribution);
      setStage(res.stage);
      if (res.bloomed && res.bloomId) {
        triggerBloom();
      } else {
        // Not enough bloom votes yet — drop the preview back to the real stage.
        setPreviewBloom(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
      setPreviewBloom(false);
      router.refresh();
    }
  }

  function triggerBloom() {
    if (blooming) return; // guard against double-trigger (vote + poll)
    playNatureSound("bloom");
    setStage("bloomed");
    setBlooming(true);
    // Auto-advance to the Sacred Tree; the celebration also has a manual button.
    setTimeout(() => router.push(`/gardens/${seed.garden.id}/tree`), 6000);
  }

  // Linear thread: everything chronologically, or filtered to one dimension.
  const visibleContributions = filterDim
    ? contributions.filter((c) => c.dimension === filterDim)
    : contributions;

  return (
    <div className="relative mt-3 grid gap-6 lg:grid-cols-[1fr_360px]">
      {showHelp && <HowItWorks onClose={() => setShowHelp(false)} />}

      {/* Floating reaction bursts (rendered over everything, position:fixed) */}
      {bursts.map((b) => (
        <span
          key={b.id}
          className="reaction-burst"
          style={{ left: b.x, top: b.y, ["--dx" as string]: `${b.dx}px` } as React.CSSProperties}
        >
          {b.emoji}
        </span>
      ))}
      {/* Floating reaction LABEL — tells you what the reaction means */}
      {labelFx.map((l) => (
        <span key={l.id} className="reaction-label" style={{ left: l.x, top: l.y }}>
          {l.text}
        </span>
      ))}

      {blooming && (
        <BloomCelebration
          title={seed.title}
          onEnter={() => router.push(`/gardens/${seed.garden.id}/tree`)}
        />
      )}

      {bloomConfirm && (
        <BloomConfirm
          bloomTarget={bloomTarget}
          bloomedVotes={bloomedVotes}
          onYes={confirmBloom}
          onNo={cancelBloom}
        />
      )}

      {/* ── Thread column ── */}
      <div>
        {/* Reopened to evolve — compact, dismissible */}
        {!isBloomed && seed.bloomId && !evolveDismissed && (
          <div className="mb-3 flex items-center gap-2 rounded-full border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.06)] px-3 py-1.5 text-xs">
            <span className="text-accent">🔄 Evolving</span>
            <span className="text-ink-soft">· published before</span>
            <button
              onClick={() => router.push(`/blooms/${seed.bloomId}`)}
              className="text-ink-mid underline hover:text-ink"
            >
              view it
            </button>
            <button
              onClick={() => setEvolveDismissed(true)}
              className="ml-auto text-ink-soft transition hover:text-ink"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bloomed → always offer the payoff, even if the live moment was missed */}
        {isBloomed && (
          <div className="mb-4 rounded-2xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.08)] p-4 text-center">
            <div className="mb-1 text-3xl">🌸</div>
            <p className="serif-lg mb-1">This seed has bloomed</p>
            <p className="mb-3 text-xs text-ink-mid">Collective knowledge, remembered forever.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {seed.bloomId && (
                <button onClick={() => router.push(`/blooms/${seed.bloomId}`)} className="btn-primary text-sm">
                  🌸 See the bloom
                </button>
              )}
              <button
                onClick={() => router.push(`/gardens/${seed.garden.id}/tree`)}
                className="btn-ghost text-sm"
              >
                🌳 Enter the Sacred Tree
              </button>
            </div>
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="eyebrow">
            🌱 Seed · by {seed.author?.name || "someone"} · {participants} participant{participants === 1 ? "" : "s"}
          </p>
          {/* Visibility — a pill for everyone, a toggle for managers */}
          {seed.canManage ? (
            <button
              onClick={toggleVisibility}
              disabled={visBusy}
              title="Toggle who can see this seed"
              className="rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-1 text-xs text-ink-mid transition hover:text-ink"
            >
              {visibility === "private" ? "🔒 Private" : "🌍 Public"} · change
            </button>
          ) : (
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-ink-soft">
              {visibility === "private" ? "🔒 Private" : "🌍 Public"}
            </span>
          )}
          {seed.canManage && (
            <button
              onClick={removeSeed}
              disabled={busy}
              title="Delete this seed"
              className="rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1 text-xs text-ink-soft transition hover:text-[#e57373]"
            >
              🗑 Delete
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            title="How Rhyza works"
            className="rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1 text-xs text-ink-soft transition hover:text-ink"
          >
            ⓘ How it works
          </button>
        </div>
        <h1 className="serif-xl mb-4">{seed.title}</h1>

        {/* Mediation — ask Claude to help resolve disagreement */}
        {!isBloomed && (
          <div className="mb-4">
            <button
              onClick={askMediate}
              disabled={mediating}
              className="btn-ghost px-3 py-1.5 text-xs"
              title="Claude reads the discussion and proposes a fair path forward"
            >
              {mediating ? "🕊️ Mediating…" : "🕊️ Ask Claude to mediate"}
            </button>
          </div>
        )}
        {seed.content && <p className="card mb-5 p-4 text-sm text-ink-mid">{seed.content}</p>}

        {/* Dimension FILTER chips (optional lens) — default 'All' is linear */}
        <div className="mb-4 flex flex-wrap gap-2 border-b border-[rgba(76,175,80,0.12)] pb-3">
          <button
            onClick={() => setFilterDim(null)}
            className="rounded-full px-3 py-1.5 text-sm transition"
            style={{
              color: filterDim === null ? "#E8E4DC" : "#A0A890",
              background: filterDim === null ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            All {contributions.length > 0 && <span className="opacity-60">{contributions.length}</span>}
          </button>
          {DIMENSIONS.map((d) => {
            const count = contributions.filter((c) => c.dimension === d.key).length;
            const active = filterDim === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setFilterDim(active ? null : d.key)}
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

        <p className="mb-3 text-[11px] text-ink-soft">
          ✨ Claude labels each message by dimension (top-right) — tap a label to change it.
        </p>

        {/* Contributions — one linear conversation */}
        <div className="space-y-3">
          {visibleContributions.length === 0 && (
            <p className="text-sm text-ink-soft">
              {filterDim ? "Nothing in this lens yet." : "No thoughts yet. Be the first to share."}
            </p>
          )}
          {visibleContributions.map((c) => {
            const cd = DIMENSIONS.find((d) => d.key === c.dimension) ?? DIMENSIONS[1];
            const isClaude = c.author?.name === "Claude";
            return (
              <div key={c.id} className={`card p-4 ${glowing.has(c.id) ? "endorsed-glow" : ""}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={c.author?.name} image={c.author?.image} size={32} />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        {c.author?.name || "Someone"}
                        {c.author?.name === "Claude" && (
                          <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[10px] font-normal text-accent">
                            ✦ AI
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-soft">{timeAgo(c.createdAt)}</p>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => !isClaude && setRetagId(retagId === c.id ? null : c.id)}
                      className="rounded-full px-2 py-0.5 text-xs transition"
                      style={{ color: cd.color, background: `${cd.color}1A` }}
                      title={isClaude ? cd.label : "Claude's label — tap to change"}
                    >
                      {classifyingIds.has(c.id) ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="claude-thinking-dot" style={{ width: 7, height: 7 }} />
                          labeling…
                        </span>
                      ) : (
                        `${cd.emoji} ${cd.label}`
                      )}
                    </button>
                    {retagId === c.id && (
                      <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(10,16,10,0.98)] p-1 shadow-xl">
                        <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-soft">Re-label as</p>
                        {DIMENSIONS.map((d) => (
                          <button
                            key={d.key}
                            onClick={() => retag(c.id, d.key)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-mid transition hover:text-ink"
                          >
                            <span>{d.emoji}</span>
                            <span style={{ color: d.color }}>{d.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {editingId === c.id ? (
                  <div className="mb-2">
                    <textarea
                      className="input min-h-[80px]"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => saveEdit(c.id)} className="btn-primary px-3 py-1 text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost px-3 py-1 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {c.text && (
                      <div className="mb-3 text-sm leading-relaxed text-ink">
                        <InlineText text={c.text} />
                      </div>
                    )}
                    <Attachments items={c.attachments ?? []} />
                  </>
                )}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {reactions.map((r) => {
                    const n = c.reactionCounts[r.key] ?? 0;
                    const mine = c.myReactions.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        onClick={(e) => react(c.id, r.key, e.currentTarget)}
                        title={r.label}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition active:scale-110 ${
                          mine ? "border-accent text-accent" : "border-[rgba(255,255,255,0.08)] text-ink-soft hover:text-ink"
                        }`}
                      >
                        <span>{r.emoji}</span>
                        <span className="opacity-80">{r.label}</span>
                        {n > 0 && <span className="font-medium">· {n}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-soft">
                  <button onClick={() => endorse(c.id)} className={`transition ${c.iEndorsed ? "text-bloom" : "hover:text-ink"}`}>
                    ✦ {c.iEndorsed ? "Endorsed" : "Endorse"}
                    {c.endorsementCount > 0 && ` · ${c.endorsementCount}`}
                  </button>
                  {c.author?.id === currentUserId && (
                    <>
                      <button
                        onClick={() => { setEditingId(c.id); setEditDraft(c.text); }}
                        className="transition hover:text-ink"
                      >
                        ✎ Edit
                      </button>
                      <button onClick={() => removeContribution(c.id)} className="transition hover:text-[#e57373]">
                        🗑 Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {thinking && (
            <div className="card flex items-center gap-2 p-4 text-sm text-ink-soft">
              <span className="claude-thinking-dot" />
              Claude is thinking…
            </div>
          )}
        </div>

        {/* Compose — hidden once you've committed your bloom vote */}
        {!isBloomed && committedToBloom && (
          <div className="card mt-6 border-[rgba(255,179,0,0.3)] bg-[rgba(255,179,0,0.06)] p-5 text-center">
            <p className="mb-1 text-sm font-medium text-bloom">🌸 You marked this ready to bloom</p>
            <p className="mb-3 text-xs text-ink-mid">
              You&apos;re viewing now — it blooms once {bloomTarget} people agree
              {bloomNeeded > 0 ? ` (${bloomNeeded} more to go)` : ""}. Changed your mind?
            </p>
            <button
              onClick={() => castVote("growing")}
              className="btn-ghost px-4 py-1.5 text-xs"
              disabled={busy}
            >
              ↩ Keep contributing
            </button>
          </div>
        )}
        {!isBloomed && !committedToBloom && (
          <div className="card mt-6 p-5">
            <p className="eyebrow mb-3">💬 Share your thought · Claude will label it</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <RichEditor
              value={draft}
              onChange={setDraft}
              placeholder={`What's your take? (**bold**, *italic*, \`code\` · @ to tag, @claude to ask)`}
              disabled={busy}
              people={seed.people}
              onSubmit={() => {
                if (!busy && !uploading && (draft.trim().length > 0 || draftAttachments.length > 0))
                  contribute();
              }}
              toolbarExtra={
                <button
                  type="button"
                  onClick={() =>
                    uploadsEnabled
                      ? fileInputRef.current?.click()
                      : setError(
                          "Attachments aren't enabled yet — connect a Vercel Blob store, then redeploy.",
                        )
                  }
                  disabled={busy || uploading}
                  title="Attach image, video, or screenshot"
                  className="h-7 rounded-md border px-2 text-sm text-ink-mid transition hover:text-ink disabled:opacity-40"
                  style={{ borderColor: "rgba(76,175,80,0.2)" }}
                >
                  {uploading ? "⏳" : "📎"}
                </button>
              }
            />

            {/* Attachment previews */}
            {draftAttachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {draftAttachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.5)] px-2 py-1 text-xs text-ink-mid"
                  >
                    <span>{a.type === "image" ? "🖼️" : a.type === "video" ? "🎬" : "📎"}</span>
                    <span className="max-w-[140px] truncate">{a.name || "file"}</span>
                    <button
                      onClick={() => setDraftAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="text-ink-soft hover:text-[#e57373]"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="mb-2 mt-2 text-sm text-[#e57373]">{error}</p>}
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-soft">
                <span className="text-accent">@claude</span> to ask · <span className="text-accent">@</span> to tag
              </span>
              <button
                onClick={contribute}
                className="btn-primary"
                disabled={busy || uploading || (draft.trim().length === 0 && draftAttachments.length === 0)}
              >
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
              <PlantSvg stage={plantStage} />
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
              {seed.canBloom && !isBloomed && (
                <button
                  onClick={bloomNow}
                  disabled={busy}
                  className="mt-3 w-full rounded-full px-3 py-2 text-xs font-medium text-bg transition"
                  style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}
                >
                  🌸 Bloom now
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function BloomConfirm({
  bloomTarget,
  bloomedVotes,
  onYes,
  onNo,
}: {
  bloomTarget: number;
  bloomedVotes: number;
  onYes: () => void;
  onNo: () => void;
}) {
  // votes including this person's pending one
  const willHave = bloomedVotes + 1;
  const remaining = Math.max(0, bloomTarget - willHave);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[rgba(10,6,0,0.7)] px-6 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6 text-center animate-[fadeUp_0.4s_ease-out]">
        <div className="mb-2 text-4xl">🌸</div>
        <h3 className="serif-lg mb-2">Mark this ready to bloom?</h3>
        <p className="mb-1 text-sm text-ink-mid">
          Voting to bloom means you&apos;re done contributing — you&apos;ll become a
          <strong className="text-ink"> viewer</strong> of this seed.
        </p>
        <p className="mb-5 text-sm text-ink-soft">
          It blooms once <strong className="text-bloom">{bloomTarget} people</strong> agree
          {remaining > 0 ? ` — ${remaining} more after you` : " — you may be the one to tip it"}.
          You can change your mind later.
        </p>
        <div className="flex gap-2">
          <button onClick={onNo} className="btn-ghost flex-1">
            No, keep contributing
          </button>
          <button
            onClick={onYes}
            className="flex-1 rounded-full px-5 py-2.5 text-sm font-medium text-bg transition"
            style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}
          >
            Yes, it&apos;s ready
          </button>
        </div>
      </div>
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

function BloomCelebration({ title, onEnter }: { title: string; onEnter: () => void }) {
  // A radial burst of petals + sparkles fanning out from the centre.
  const burst = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * 360 + Math.random() * 10;
        const dist = 130 + Math.random() * 160;
        const rad = (angle * Math.PI) / 180;
        return {
          emoji: ["🌸", "🌼", "🌺", "🍃", "✨", "💛"][i % 6],
          bx: `${Math.cos(rad) * dist}%`,
          by: `${Math.sin(rad) * dist}%`,
          delay: (i % 10) * 0.05,
          size: 16 + Math.round(Math.random() * 16),
        };
      }),
    [],
  );
  // A gentle rain of petals drifting down across the screen.
  const petals = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        emoji: ["🌸", "🌼", "🌺", "🍃"][i % 4],
        left: Math.round((i / 18) * 100 + Math.random() * 5),
        delay: Math.random() * 2.2,
        dur: 4 + Math.random() * 3,
        size: 14 + Math.round(Math.random() * 16),
        sway: `${(Math.random() * 60 - 30).toFixed(0)}px`,
      })),
    [],
  );
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[rgba(20,10,0,0.88)] px-6 text-center backdrop-blur">
      {/* expanding glow rings behind the plant */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="bloom-glow" />
        <span className="bloom-glow" style={{ animationDelay: "0.5s" }} />
      </div>

      {/* petal rain */}
      <div className="pointer-events-none absolute inset-0">
        {petals.map((p, i) => (
          <span
            key={i}
            className="petal-fall"
            style={{
              left: `${p.left}%`,
              fontSize: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ["--sway" as string]: p.sway,
            } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* radial burst */}
      <div className="pointer-events-none absolute inset-0">
        {burst.map((l, i) => (
          <span
            key={i}
            className="leaf-particle"
            style={{ fontSize: l.size, animationDelay: `${l.delay}s`, ["--bx" as string]: l.bx, ["--by" as string]: l.by, ["--bx2" as string]: l.bx, ["--by2" as string]: l.by } as React.CSSProperties}
          >
            {l.emoji}
          </span>
        ))}
      </div>

      <div className="relative animate-[fadeUp_0.8s_ease-out]">
        <div className="mx-auto mb-2 h-44 w-44 drop-shadow-[0_0_40px_rgba(255,179,0,0.55)]">
          <PlantSvg stage={4} />
        </div>
        <p className="eyebrow mb-2 text-bloom">✨ This seed has bloomed ✨</p>
        <h2 className="serif-lg mx-auto max-w-md bloom-shimmer">{title}</h2>
        <p className="mt-3 text-sm text-ink-mid">
          Collective knowledge, forever remembered.
        </p>
        <button onClick={onEnter} className="btn-primary mt-5 animate-pulse">
          Enter the Sacred Tree →
        </button>
      </div>
    </div>
  );
}
