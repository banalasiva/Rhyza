"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeedDetail } from "@/lib/services/seeds";
import {
  DIMENSIONS,
  STAGES,
  stageIndex,
  bloomTargetFor,
  type DimensionKey,
} from "@/lib/constants";
import { apiPost, apiGet } from "@/lib/client";
import { playNatureSound, setMuted } from "@/lib/sound";
import { timeAgo } from "@/lib/time";
import { upload } from "@vercel/blob/client";
import { PlantSvg } from "@/components/PlantSvg";
import { HowItWorks } from "@/components/HowItWorks";
import { RichEditor } from "@/components/RichEditor";
import { InlineText } from "@/components/InlineText";
import { serializeMentions, deserializeMentions } from "@/lib/mentions";
import { shareOrCopy } from "@/lib/share-client";
import { CollapsibleText } from "@/components/CollapsibleText";
import { Avatar } from "@/components/Avatar";
import { Attachments, type Attachment } from "@/components/Attachments";
import { StakeMap } from "@/components/StakeMap";
import { type Board } from "@/components/StakeBoard";
import { PollCard, PollCreator, type Poll } from "@/components/SeedPolls";
import { QuorumV2 } from "@/components/QuorumV2";
import { Icon, type IconName } from "@/components/Icon";
import { ReadAloud } from "@/components/ReadAloud";
import { MicButton } from "@/components/MicButton";
import { MessageActions } from "@/components/MessageActions";
import { SeedInvite } from "@/components/SeedInvite";
import { MembersSheet } from "@/components/MembersSheet";

const SEED_TABS = [
  { key: "discuss", label: "Discuss", icon: "discussion" },
  { key: "decide", label: "Decide", icon: "quorum" },
  { key: "bloom", label: "Bloom", icon: "bloom" },
] as const satisfies readonly { key: string; label: string; icon: IconName }[];

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
  aiReplies?: Omit<ContributionResponse, "aiReplies" | "aiError">[];
  aiError?: string | null;
};

// Turn a bare API contribution into a full client-side Contribution (with the
// reaction/endorsement fields the UI tracks locally).
function hydrate(c: Omit<ContributionResponse, "aiReplies">): Contribution {
  return {
    id: c.id,
    dimension: c.dimension,
    text: c.text,
    attachments: c.attachments ?? [],
    parentId: c.parentId ?? null,
    author: c.author,
    createdAt: c.createdAt,
    reactionCounts: {},
    reactionPeople: {},
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
  const [aiMenu, setAiMenu] = useState(false); // compact "Ask AI" menu
  const [summarizing, setSummarizing] = useState<"claude" | "chatgpt" | null>(null);
  const [summary, setSummary] = useState<{ provider: "claude" | "chatgpt"; text: string } | null>(
    null,
  );
  const [tab, setTab] = useState<"discuss" | "decide" | "bloom">("discuss");
  // Polls live inline in the Discuss thread now (created from the composer).
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [stakeBoard, setStakeBoard] = useState<Board | null>(null);
  // Seed title/framing — local copies so an edit shows instantly.
  const [seedTitle, setSeedTitle] = useState(seed.title);
  const [seedContent, setSeedContent] = useState(seed.content);
  const [seedMenu, setSeedMenu] = useState(false); // tap-the-question details sheet
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false); // invite form within the details sheet
  const [editingSeed, setEditingSeed] = useState(false);
  const [seedTitleDraft, setSeedTitleDraft] = useState(seed.title);
  const [seedContentDraft, setSeedContentDraft] = useState(seed.content);
  // Which message's action sheet is open (reactions + edit/copy/share/…).
  const [sheetForId, setSheetForId] = useState<string | null>(null);
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  const [retagId, setRetagId] = useState<string | null>(null); // open re-tag menu
  const [draft, setDraft] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null); // scroll target when switching tabs
  const threadEndRef = useRef<HTMLDivElement>(null); // scroll target for the latest message
  const tabsMounted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blooming, setBlooming] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [glowing, setGlowing] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState(false);
  const [thinkingWho, setThinkingWho] = useState("Claude");
  const [mediating, setMediating] = useState(false);
  const [mediatingWho, setMediatingWho] = useState<"claude" | "chatgpt" | null>(null);
  const [aiVoting, setAiVoting] = useState<"claude" | "chatgpt" | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">(seed.visibility);
  const [visBusy, setVisBusy] = useState(false);
  const [listed, setListed] = useState<boolean>(seed.listed ?? false);
  const [following, setFollowing] = useState<boolean>(seed.following ?? false);
  const [followLevel, setFollowLevelState] = useState<string>(
    seed.followLevel ?? (seed.following ? "all" : "highlights"),
  );
  const [bloomConfirm, setBloomConfirm] = useState(false); // confirm modal open
  const [previewBloom, setPreviewBloom] = useState(false); // flower the plant as a preview
  const [bursts, setBursts] = useState<
    { id: number; emoji: string; x: number; y: number; dx: number }[]
  >([]);
  const [labelFx, setLabelFx] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const burstId = useRef(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => setMuted(muted), [muted]);

  // Load the stake board once so the rail glance + Quorum tab share one source.
  useEffect(() => {
    apiGet<Board>(`/api/seeds/${seed.id}/stake`)
      .then(setStakeBoard)
      .catch(() => {});
  }, [seed.id]);

  // Polls render inline in the Discuss thread. Load them, then keep them live on
  // the same cadence as the thread so other people's votes/closes appear without
  // a refresh — but skip a refresh briefly after the viewer's own action so an
  // in-flight optimistic vote isn't reverted.
  const pollTouchedRef = useRef<number>(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (Date.now() - pollTouchedRef.current < 6000) return;
      apiGet<Poll[]>(`/api/seeds/${seed.id}/polls`)
        .then((p) => { if (alive) setPolls(p); })
        .catch(() => {});
    };
    refresh();
    const t = setInterval(refresh, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [seed.id]);

  async function votePoll(pollId: string, optionId: string) {
    pollTouchedRef.current = Date.now();
    setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, myVote: optionId } : p)));
    playNatureSound("drop");
    try {
      setPolls(await apiPost<Poll[]>(`/api/polls/${pollId}/vote`, { optionId }));
    } catch {
      apiGet<Poll[]>(`/api/seeds/${seed.id}/polls`).then(setPolls).catch(() => {});
    }
  }
  async function closePoll(pollId: string, closed: boolean) {
    pollTouchedRef.current = Date.now();
    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed }),
      });
      setPolls(await res.json());
    } catch {
      apiGet<Poll[]>(`/api/seeds/${seed.id}/polls`).then(setPolls).catch(() => {});
    }
  }
  async function deletePoll(pollId: string) {
    if (!confirm("Delete this poll?")) return;
    pollTouchedRef.current = Date.now();
    try {
      const res = await fetch(`/api/polls/${pollId}`, { method: "DELETE" });
      setPolls(await res.json());
    } catch {
      apiGet<Poll[]>(`/api/seeds/${seed.id}/polls`).then(setPolls).catch(() => {});
    }
  }

  // Deep link from a notification (…/seeds/:id#c-<contributionId>) — scroll to
  // the exact message and pulse it so it's easy to spot.
  useEffect(() => {
    const m = typeof window !== "undefined" && window.location.hash.match(/^#c-([0-9a-fA-F-]{36})$/);
    if (!m) {
      // No specific anchor — drop the arriver on the latest message so they land
      // where the conversation actually is, not at the top hero.
      const t = setTimeout(
        () => threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        400,
      );
      return () => clearTimeout(t);
    }
    const id = m[1];
    const t = setTimeout(() => {
      const el = document.getElementById(`c-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setGlowing((s) => new Set(s).add(id));
      setTimeout(() => setGlowing((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      }), 2200);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the section tab changes (e.g. via the rail's "Open the Quorum tab"
  // button at the bottom), bring the tabs/content back into view — otherwise
  // you switch tabs but stay scrolled at the bottom of the previous one.
  useEffect(() => {
    if (!tabsMounted.current) {
      tabsMounted.current = true; // skip the initial render
      return;
    }
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab]);

  // Show the walkthrough automatically the first time someone opens a seed.
  useEffect(() => {
    try {
      if (!localStorage.getItem("thinkthru_seen_intro")) {
        setShowHelp(true);
        localStorage.setItem("thinkthru_seen_intro", "1");
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
        if (json?.stage === "bloomed") triggerBloom();
      } catch {
        /* transient — keep polling */
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, blooming, seed.id]);

  // Live room: every few seconds pull the whole current snapshot so reactions,
  // edits, deletes, endorsements AND the readiness votes of *other* people show
  // up without a refresh (no websocket needed on Vercel serverless). Two things
  // are protected from the poll so it never fights an in-flight optimistic
  // update: messages still being sent (temp-…), and anything the viewer just
  // touched — tracked in pendingRef (reactions/edits/votes) and removedRef
  // (deletes) with a short time window.
  const pendingRef = useRef<Map<string, number>>(new Map());
  const removedRef = useRef<Map<string, number>>(new Map());
  // How many of the viewer's own posts are in flight. While > 0 the live poll
  // leaves the thread alone, so the server's copy of a just-sent message can't
  // appear alongside its optimistic twin (the "two then one" flash).
  const postingRef = useRef(0);
  // A hard re-entrancy lock for sending. `busy` is React state and lags a fast
  // double-tap (or a tap while a slow AI reply is still in flight), which let the
  // same message post twice — especially when @claude/@chatgpt were tagged and
  // the reply took a few seconds. This ref flips synchronously, so a second
  // invocation is dropped before it can create a duplicate.
  const sendingRef = useRef(false);
  const markPending = useCallback((id: string) => {
    pendingRef.current.set(id, Date.now());
  }, []);
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/seeds/${seed.id}/sync`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const snap = json as
          | {
              contributions: Contribution[];
              distribution: typeof distribution;
              stage: string;
              myVote: string | null;
            }
          | undefined;
        if (!snap) return;

        const now = Date.now();
        for (const [id, t0] of pendingRef.current) if (now - t0 > 8000) pendingRef.current.delete(id);
        for (const [id, t0] of removedRef.current) if (now - t0 > 8000) removedRef.current.delete(id);

        setContributions((prev) => {
          // Don't reconcile while the viewer is mid-post — otherwise the
          // server's freshly-saved copy shows next to the optimistic temp.
          if (postingRef.current > 0) return prev;
          const prevById = new Map(prev.map((c) => [c.id, c]));
          const temps = prev.filter((c) => c.id.startsWith("temp-"));
          const merged: Contribution[] = [];
          for (const s of snap.contributions) {
            if (removedRef.current.has(s.id)) continue; // viewer just deleted it
            // Keep the local copy for anything the viewer just acted on, so a
            // mid-flight reaction/edit isn't briefly reverted by the poll.
            const local = prevById.get(s.id);
            merged.push(local && pendingRef.current.has(s.id) ? local : s);
          }
          const next = [...merged, ...temps];
          next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return next;
        });

        setDistribution(snap.distribution);
        // Don't yank the plant/vote out from under a vote the viewer just cast.
        if (!pendingRef.current.has("__vote__")) {
          setStage(snap.stage);
          setMyVote(snap.myVote);
        }
      } catch {
        /* transient — keep polling */
      }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.id]);

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

  // The readiness bars are read against the whole quorum (everyone in the
  // conversation, AI included), NOT just the people who've voted — so two
  // votes out of six reads as 33%, not 50%, and the rest shows as "not yet."
  const quorumSize = Math.max(participants, totalVotes, 1);
  const notVoted = Math.max(0, quorumSize - totalVotes);
  const pctOfQuorum = (votes: number) => Math.round((votes / quorumSize) * 100);

  const dimsWithContribs = useMemo(
    () => new Set(contributions.map((c) => c.dimension)).size,
    [contributions],
  );

  const bloomedVotes = distribution.find((d) => d.stage === "bloomed")?.votes ?? 0;
  const bloomTarget = bloomTargetFor(participants);
  const bloomNeeded = Math.max(0, bloomTarget - bloomedVotes);
  const bloomReady = bloomedVotes >= bloomTarget && dimsWithContribs >= 3;

  // Convergence signal read LIVE from the stage votes — so it moves as people
  // vote, including when they vote it *backwards* (an earlier stage) to say the
  // direction slipped.
  const convergence = useMemo(() => {
    if (isBloomed)
      return { label: "Bloomed", color: "#FFB300", note: "Collective knowledge, remembered." };
    const total = distribution.reduce((n, d) => n + d.votes, 0);
    if (total === 0)
      return { label: "Awaiting votes", color: "#8a9482", note: "Vote a stage to show where you feel it stands." };
    const anchor = stageIndex(stage);
    let behind = 0,
      ahead = 0,
      at = 0,
      distinct = 0;
    for (const d of distribution) {
      if (d.votes <= 0) continue;
      distinct++;
      const i = STAGES.findIndex((s) => s.key === d.stage);
      if (i < anchor) behind += d.votes;
      else if (i > anchor) ahead += d.votes;
      else at += d.votes;
    }
    const f = (n: number) => n / total;
    if (f(behind) >= 0.34)
      return { label: "Pulling back", color: "#EF9A9A", note: "Some feel the direction slipped — worth revisiting." };
    if (f(ahead) >= 0.34)
      return { label: "Gaining momentum", color: "#66BB6A", note: "The community is pushing it forward." };
    if (distinct >= 3 && f(at) < 0.5)
      return { label: "Diverging", color: "#FFB300", note: "Healthy spread — perspectives still forming." };
    if (f(at) >= 0.5)
      return { label: "Converging", color: "#66BB6A", note: "The community is aligning on where it stands." };
    return { label: "Building", color: "#FFB300", note: "Understanding is taking shape." };
  }, [distribution, stage, isBloomed]);

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
    if (sendingRef.current) return; // already sending — ignore the double-tap
    sendingRef.current = true;
    setBusy(true);
    setError(null);
    postingRef.current += 1; // pause the live poll until this post settles
    const tagsClaude = /(^|[^a-zA-Z0-9])@claude\b/i.test(text);
    const tagsChatGpt = /(^|[^a-zA-Z0-9])@(chatgpt|openai|gpt)\b/i.test(text);
    const tagsAI = tagsClaude || tagsChatGpt;

    // Print the person's own message immediately, before the AI is asked, so
    // the order reads naturally: your message first, the AI's answer after. We
    // reuse the viewer's name/avatar from any message they've already posted;
    // the server's canonical record replaces this the moment it returns.
    const tempId = `temp-${Date.now()}`;
    const mine = contributions.find((c) => c.author.id === currentUserId)?.author;
    const sentAttachments = draftAttachments;
    const optimistic = hydrate({
      id: tempId,
      dimension: "understanding",
      text,
      attachments: sentAttachments,
      parentId: null,
      author: mine ?? { id: currentUserId, name: "You", image: null },
      createdAt: new Date().toISOString(),
    });
    setContributions((prev) => [...prev, optimistic]);
    setDraft("");
    setDraftAttachments([]);
    playNatureSound("drop");

    try {
      // If an AI is tagged, show a "thinking" placeholder while it replies.
      if (tagsAI) {
        setThinkingWho(tagsClaude && tagsChatGpt ? "Claude and ChatGPT" : tagsChatGpt ? "ChatGPT" : "Claude");
        setThinking(true);
      }
      // No dimension sent — people just write; Claude labels it after posting.
      // Convert "@Name" back into the stored @[Name](id) token here, at the edge.
      const c = await apiPost<ContributionResponse>(`/api/seeds/${seed.id}/contributions`, {
        text: serializeMentions(text, seed.people),
        attachments: sentAttachments,
      });
      const replies = c.aiReplies ?? [];
      // Swap the optimistic copy for the server's record, then append AI replies
      // — de-duping in case a live poll already slipped the server's copy in.
      setContributions((prev) => {
        const next = prev.filter((x) => x.id !== tempId);
        const ids = new Set(next.map((x) => x.id));
        if (!ids.has(c.id)) {
          next.push(hydrate(c));
          ids.add(c.id);
        }
        for (const r of replies)
          if (!ids.has(r.id)) {
            next.push(hydrate(r));
            ids.add(r.id);
          }
        return next;
      });
      if (replies.length) playNatureSound("chirp");
      if (tagsAI && replies.length === 0) {
        setError(
          c.aiError === "not_configured"
            ? "The AI you tagged isn't configured — add its API key (ANTHROPIC_API_KEY or OPENAI_API_KEY) in Vercel and redeploy."
            : `The AI couldn't reply: ${c.aiError ?? "unknown error"}`,
        );
      }
      // Let Claude label the dimension in the background; the badge fills in.
      classify(c.id);
    } catch (err) {
      // Roll back the optimistic message and restore the draft so nothing is lost.
      setContributions((prev) => prev.filter((x) => x.id !== tempId));
      setDraft(text);
      setDraftAttachments(sentAttachments);
      setError(err instanceof Error ? err.message : "Failed to contribute");
    } finally {
      setThinking(false);
      setBusy(false);
      sendingRef.current = false;
      postingRef.current = Math.max(0, postingRef.current - 1);
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

  async function askMediate(provider: "claude" | "chatgpt") {
    setMediating(true);
    setMediatingWho(provider);
    setError(null);
    try {
      const c = await apiPost<ContributionResponse>(`/api/seeds/${seed.id}/mediate`, { provider });
      setContributions((prev) => [...prev, hydrate(c)]);
      playNatureSound("chirp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mediation failed");
    } finally {
      setMediating(false);
      setMediatingWho(null);
    }
  }

  // Ask an AI to summarize the whole thread by dimension — replaces manual
  // dimension navigation. Read-only; shown in a dismissible panel.
  async function askSummary(provider: "claude" | "chatgpt") {
    setAiMenu(false);
    setSummarizing(provider);
    setError(null);
    try {
      const res = await apiPost<{ text: string; provider: "claude" | "chatgpt" }>(
        `/api/seeds/${seed.id}/summary`,
        { provider },
      );
      setSummary({ provider, text: res.text });
      playNatureSound("chirp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't summarize");
    } finally {
      setSummarizing(null);
    }
  }

  async function askAIVote(provider: "claude" | "chatgpt") {
    if (isBloomed || aiVoting) return;
    setAiVoting(provider);
    setError(null);
    try {
      const res = await apiPost<{
        contribution: ContributionResponse;
        distribution: typeof distribution;
        stage: string;
        bloomed: boolean;
        bloomId: string | null;
      }>(`/api/seeds/${seed.id}/ai-vote`, { provider });
      setContributions((prev) => [...prev, hydrate(res.contribution)]);
      setDistribution(res.distribution);
      setStage(res.stage);
      playNatureSound("wind");
      if (res.bloomed && res.bloomId) triggerBloom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI vote failed");
    } finally {
      setAiVoting(null);
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

  // Publish the seed to the world (Explore) or pull it back. Needs it public.
  async function toggleListed() {
    const next = !listed;
    if (next && visibility !== "public") {
      setError("Make the seed public first, then share it with the world.");
      return;
    }
    setListed(next); // optimistic
    setError(null);
    try {
      await apiPost(`/api/seeds/${seed.id}/listed`, { listed: next });
    } catch (err) {
      setListed(!next);
      setError(err instanceof Error ? err.message : "Couldn't update");
    }
  }

  // Set how loudly you follow this seed: "all" (every reply), "highlights"
  // (blooms/decisions/mentions), or "off" (stop following). Optimistic.
  async function setFollow(level: "all" | "highlights" | "off") {
    const prevF = following;
    const prevL = followLevel;
    setFollowing(level !== "off");
    if (level !== "off") setFollowLevelState(level);
    try {
      await apiPost(`/api/seeds/${seed.id}/follow`, { level });
    } catch {
      setFollowing(prevF);
      setFollowLevelState(prevL);
    }
  }

  async function reportSeed() {
    const reason = prompt("What's wrong with this seed? (a short reason)");
    if (!reason || !reason.trim()) return;
    try {
      await apiPost(`/api/seeds/${seed.id}/report`, { reason: reason.trim() });
      setError("Thanks — reported. We'll take a look.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't report");
    }
  }

  // Save an edit to the seed's question / framing.
  async function saveSeedEdit() {
    const title = seedTitleDraft.trim();
    const content = seedContentDraft.trim();
    if (title.length < 4) {
      setError("Give your seed a clear question (at least 4 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seeds/${seed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Couldn't save the edit");
      }
      setSeedTitle(title);
      setSeedContent(content);
      setEditingSeed(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the edit");
    } finally {
      setBusy(false);
    }
  }

  // Leave the seed yourself (non-owners). Revokes access on a private seed.
  async function leaveSeed() {
    if (!confirm("Leave this seed? If it's private, you'll lose access.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seeds/${seed.id}/members`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Couldn't leave the seed");
      }
      router.push(`/gardens/${seed.garden.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't leave the seed");
      setBusy(false);
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
    markPending(contributionId);
    // Update the UI first so the click feels instant, then play the sound.
    setContributions((prev) =>
      prev.map((c) => {
        if (c.id !== contributionId) return c;
        const has = c.myReactions.includes(key);
        const counts = { ...c.reactionCounts };
        counts[key] = (counts[key] ?? 0) + (has ? -1 : 1);
        if (counts[key] <= 0) delete counts[key];
        // Keep the "who reacted" list in sync so the hover updates instantly.
        const people = { ...c.reactionPeople };
        const list = (people[key] ?? []).filter((n) => n !== "You");
        people[key] = has ? list : [...list, "You"];
        if (people[key].length === 0) delete people[key];
        return {
          ...c,
          reactionCounts: counts,
          reactionPeople: people,
          myReactions: has ? c.myReactions.filter((k) => k !== key) : [...c.myReactions, key],
        };
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
    markPending(contributionId);
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
    const display = editDraft.trim();
    if (!display) return;
    // Editor works in "@Name" form; store the @[Name](id) token form.
    const text = serializeMentions(display, seed.people);
    markPending(id);
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
    if (!confirm("Delete this thought?")) return;
    // Remember the delete so the live poll doesn't briefly re-add it before the
    // server has processed the DELETE.
    removedRef.current.set(id, Date.now());
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
    markPending("__vote__");

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

  // One linear conversation, chronological. (Dimensions live as per-message
  // badges + the on-demand AI summary, not as a manual filter.)
  const visibleContributions = contributions;

  // Merge messages + polls into one time-ordered timeline for the Discuss thread.
  type TimelineItem =
    | { kind: "msg"; t: number; c: Contribution }
    | { kind: "poll"; t: number; p: Poll };
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...visibleContributions.map((c) => ({ kind: "msg" as const, t: Date.parse(c.createdAt), c })),
      ...polls.map((p) => ({ kind: "poll" as const, t: Date.parse(p.createdAt), p })),
    ];
    items.sort((a, b) => a.t - b.t);
    return items;
  }, [visibleContributions, polls]);
  // The message whose action sheet is open (looked up live so reactions /
  // endorsements stay current while the sheet is showing).
  const sheetC = sheetForId ? contributions.find((c) => c.id === sheetForId) ?? null : null;

  return (
    <div className="relative mt-3 grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Screen-reader status announcements (WCAG 4.1.3) */}
      <div aria-live="polite" className="sr-only">
        {thinking
          ? `${thinkingWho} is thinking…`
          : mediating
            ? `${mediatingWho === "chatgpt" ? "ChatGPT" : "Claude"} is mediating…`
            : error ?? ""}
      </div>
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
        {/* Tabs: Discussion · Polls · Quorum */}
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Seed sections"
          className="mb-4 flex scroll-mt-4 gap-1 rounded-full border border-[rgba(76,175,80,0.15)] bg-[rgba(7,13,7,0.5)] p-1 text-sm"
        >
          {SEED_TABS.map((t, idx) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={active}
                aria-controls={`panel-${t.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const dir = e.key === "ArrowRight" ? 1 : -1;
                  const nt = SEED_TABS[(idx + dir + SEED_TABS.length) % SEED_TABS.length];
                  setTab(nt.key);
                  requestAnimationFrame(() => document.getElementById(`tab-${nt.key}`)?.focus());
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 transition"
                style={{
                  background: active ? "rgba(76,175,80,0.18)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-soft)",
                }}
              >
                <span
                  aria-hidden
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: active ? "var(--accent)" : "rgba(76,175,80,0.16)",
                    color: active ? "#ffffff" : "var(--ink-soft)",
                  }}
                >
                  {idx + 1}
                </span>
                <Icon name={t.icon} size={16} muted={!active} />
                {t.label}
                {t.key === "decide" && stakeBoard && stakeBoard.pendingAdmissions.length > 0 && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    aria-label="Someone wants into the decision"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "decide" ? (
          <div className="space-y-4">
            {/* Always show WHAT is being decided, so the vote connects to the
                question people raised in Discuss. */}
            <div className="rounded-2xl border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] p-4">
              <p className="eyebrow mb-1">⚖️ Deciding together</p>
              <p className="serif-lg leading-snug">{seed.title}</p>
              <p className="mt-1 text-xs text-ink-soft">
                Everyone gives their honest read below — it adds up to one fair group answer.
              </p>
            </div>
            <QuorumV2 seedId={seed.id} />
          </div>
        ) : tab === "bloom" ? (
          <div className="space-y-4">
            {isBloomed ? (
              <div className="rounded-2xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.08)] p-5 text-center">
                <div className="mb-1 text-3xl">🌸</div>
                <p className="serif-lg mb-1">This seed has bloomed</p>
                <p className="mb-3 text-xs text-ink-mid">Collective knowledge, remembered forever.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {seed.bloomId && (
                    <button onClick={() => router.push(`/blooms/${seed.bloomId}`)} className="btn-primary text-sm">
                      🌸 See the bloom
                    </button>
                  )}
                  <button onClick={() => router.push(`/gardens/${seed.garden.id}/tree`)} className="btn-ghost text-sm">
                    View the Sacred Tree
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-5">
                <p className="eyebrow mb-2" style={{ color: bloomReady ? "#FFB300" : "#5A6456" }}>
                  🌸 Ready to bloom?
                </p>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (bloomedVotes / bloomTarget) * 100)}%`,
                      background: bloomReady ? "linear-gradient(to right,#FFD54F,#FF8F00)" : "rgba(255,179,0,0.4)",
                      transition: "width 0.7s",
                    }}
                  />
                </div>
                <p className="mb-3 text-xs text-ink-mid">
                  {bloomedVotes} of {bloomTarget} people have voted to bloom
                  {bloomNeeded > 0 ? ` — ${bloomNeeded} more to go` : " — ready!"}
                </p>
                <Requirement met={bloomedVotes >= bloomTarget} label={`${bloomedVotes} of ${bloomTarget} voted to bloom`} />
                <Requirement met={dimsWithContribs >= 3} label={`${dimsWithContribs} of 3 dimensions explored`} />
                <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
                  A seed blooms when the community feels it&apos;s ready. When it does, Claude distils the
                  discussion into durable knowledge in your Sacred Tree.
                </p>
                {seed.canBloom && (
                  <button
                    onClick={bloomNow}
                    disabled={busy}
                    className="mt-4 w-full rounded-full px-3 py-2.5 text-sm font-medium text-bg transition"
                    style={{ background: "linear-gradient(135deg,#FFB300,#FF8F00)" }}
                  >
                    🌸 Bloom now
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
        <>
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
        {editingSeed ? (
          /* Inline edit of the question + framing (managers only). */
          <div className="mb-4">
            <p className="eyebrow mb-2">✎ Edit your seed</p>
            <input
              className="input mb-2 text-base"
              value={seedTitleDraft}
              onChange={(e) => setSeedTitleDraft(e.target.value)}
              placeholder="Your question"
              autoFocus
            />
            <textarea
              className="input min-h-[80px]"
              value={seedContentDraft}
              onChange={(e) => setSeedContentDraft(e.target.value)}
              placeholder="Add framing or context (optional)"
            />
            <div className="mt-2 flex gap-2">
              <button onClick={saveSeedEdit} disabled={busy} className="btn-primary px-3 py-1 text-xs">
                Save
              </button>
              <button
                onClick={() => {
                  setEditingSeed(false);
                  setSeedTitleDraft(seedTitle);
                  setSeedContentDraft(seedContent);
                }}
                className="btn-ghost px-3 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="serif-xl mb-1 break-words">{seedTitle}</h1>
            {/* Slack-style one-line meta — tap to open the details sheet. */}
            <button
              onClick={() => {
                setSeedMenu(true);
                setInviteOpen(false);
              }}
              aria-haspopup="dialog"
              className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-soft transition hover:text-ink"
            >
              <span>{visibility === "private" ? "🔒 Private" : "🌍 Public"}</span>
              <span aria-hidden>·</span>
              <span>
                {participants} member{participants === 1 ? "" : "s"}
              </span>
              <span aria-hidden className="text-sm leading-none">
                ⌄
              </span>
            </button>
          </>
        )}

        {/* Compact AI helpers — summarize the thread, or ask an AI to mediate.
            Tucked into one small menu so it doesn't eat space on mobile. */}
        <div className="relative mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-soft">
            ✨ Each message is auto-labelled by dimension — tap a label to change it.
          </p>
          <button
            onClick={() => setAiMenu((v) => !v)}
            aria-expanded={aiMenu}
            aria-haspopup="menu"
            className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
          >
            ✨ Ask AI {aiMenu ? "▴" : "▾"}
          </button>
          {aiMenu && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setAiMenu(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-60 rounded-xl border border-[rgba(76,175,80,0.22)] bg-[#0B120B] p-2 shadow-xl"
              >
                <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-ink-soft">
                  📋 Summarize the discussion
                </p>
                <div className="mb-2 flex gap-1.5">
                  {(["claude", "chatgpt"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => askSummary(p)}
                      disabled={summarizing !== null}
                      className="flex-1 rounded-lg border border-[rgba(76,175,80,0.2)] px-2 py-1.5 text-[11px] text-ink-mid transition hover:text-ink disabled:opacity-50"
                    >
                      {summarizing === p ? "…" : p === "claude" ? "Claude" : "ChatGPT"}
                    </button>
                  ))}
                </div>
                {!isBloomed && (
                  <>
                    <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-ink-soft">
                      🕊️ Mediate a disagreement
                    </p>
                    <div className="flex gap-1.5">
                      {(["claude", "chatgpt"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setAiMenu(false);
                            askMediate(p);
                          }}
                          disabled={mediating}
                          className="flex-1 rounded-lg border border-[rgba(76,175,80,0.2)] px-2 py-1.5 text-[11px] text-ink-mid transition hover:text-ink disabled:opacity-50"
                        >
                          {mediatingWho === p ? "…" : p === "claude" ? "Claude" : "ChatGPT"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* On-demand AI summary — replaces manual dimension navigation. */}
        {summary && (
          <div className="card mb-4 border-[rgba(76,175,80,0.25)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink">
                ✨ {summary.provider === "chatgpt" ? "ChatGPT" : "Claude"} · discussion summary
              </p>
              <button
                onClick={() => setSummary(null)}
                aria-label="Dismiss summary"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="text-sm leading-relaxed text-ink-mid">
              <InlineText text={summary.text} />
            </div>
          </div>
        )}

        {/* Contributions — one linear conversation */}
        <div className="space-y-3">
          {timeline.length === 0 && (
            <p className="text-sm text-ink-soft">No thoughts yet. Be the first to share.</p>
          )}
          {timeline.map((it) => {
            if (it.kind === "poll") {
              return (
                <PollCard
                  key={`poll-${it.p.id}`}
                  poll={it.p}
                  onVote={votePoll}
                  onClose={closePoll}
                  onDelete={deletePoll}
                />
              );
            }
            const c = it.c;
            const cd = DIMENSIONS.find((d) => d.key === c.dimension) ?? DIMENSIONS[1];
            const isAI = c.author?.name === "Claude" || c.author?.name === "ChatGPT";
            return (
              <div id={`c-${c.id}`} key={c.id} className={`card scroll-mt-20 p-4 ${glowing.has(c.id) ? "endorsed-glow" : ""}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={c.author?.name} image={c.author?.image} size={32} />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        {c.author?.id && !isAI ? (
                          <Link href={`/u/${c.author.id}`} className="transition hover:text-accent hover:underline">
                            {c.author?.name || "Someone"}
                          </Link>
                        ) : (
                          c.author?.name || "Someone"
                        )}
                        {isAI && (
                          <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-1.5 py-0.5 text-[10px] font-normal text-accent">
                            ✦ AI
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                        {timeAgo(c.createdAt)}
                        {c.endorsementCount >= 2 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(76,175,80,0.12)] px-1.5 py-0.5 text-[9px] font-medium text-accent"
                            title={`${c.endorsementCount} people found this valuable`}
                          >
                            🌱 Taking root
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => !isAI && setRetagId(retagId === c.id ? null : c.id)}
                      className="rounded-full px-2 py-0.5 text-xs transition"
                      style={{ color: cd.color, background: `${cd.color}1A` }}
                      title={isAI ? cd.label : "Claude's label — tap to change"}
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
                        <CollapsibleText text={c.text} />
                      </div>
                    )}
                    <Attachments items={c.attachments ?? []} />
                  </>
                )}
                {/* Compact footer — existing reactions + a ⋯ that opens the
                    full action sheet (react / endorse / copy / share / …). */}
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                  {reactions.some((r) => (c.reactionCounts[r.key] ?? 0) > 0) && (
                    <button
                      onClick={() => setSheetForId(c.id)}
                      className="flex flex-wrap items-center gap-1"
                      aria-label="Reactions — tap to react"
                    >
                      {reactions
                        .filter((r) => (c.reactionCounts[r.key] ?? 0) > 0)
                        .map((r) => {
                          const who = (c.reactionPeople[r.key] ?? []).join(", ");
                          return (
                            <span
                              key={r.key}
                              title={`${r.label}: ${who}`}
                              className={`group/react relative inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${
                                c.myReactions.includes(r.key)
                                  ? "border-accent text-accent"
                                  : "border-[rgba(255,255,255,0.18)] text-ink-mid"
                              }`}
                            >
                              <span aria-hidden>{r.emoji}</span>
                              <span>{c.reactionCounts[r.key]}</span>
                              {/* Instant hover tooltip — native title is too slow.
                                  Pointer-events-none so it never blocks the tap. */}
                              {who && (
                                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[rgba(255,255,255,0.12)] bg-[#0B120B] px-2 py-1 text-[11px] text-ink shadow-lg group-hover/react:block">
                                  {r.label} · {who}
                                </span>
                              )}
                            </span>
                          );
                        })}
                    </button>
                  )}
                  {c.endorsementCount > 0 && (
                    <span className={c.iEndorsed ? "text-bloom" : ""} aria-label={`${c.endorsementCount} endorsements`}>
                      ✦ {c.endorsementCount}
                    </span>
                  )}
                  <button
                    onClick={() => setSheetForId(c.id)}
                    aria-label="Thought actions — react, endorse, edit"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.16)] px-2.5 py-1 text-xs leading-none text-ink-mid transition hover:border-accent hover:text-ink"
                  >
                    <span className="text-sm leading-none" aria-hidden>⋯</span>
                    {c.author?.id === currentUserId ? "Edit" : "More"}
                  </button>
                </div>
              </div>
            );
          })}
          {thinking && (
            <div className="card flex items-center gap-2 p-4 text-sm text-ink-soft">
              <span className="claude-thinking-dot" />
              {thinkingWho} {thinkingWho.includes("and") ? "are" : "is"} thinking…
            </div>
          )}
          {/* Scroll anchor: arrivals without a deep-link land on the latest message. */}
          <div ref={threadEndRef} />
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
            <p className="eyebrow mb-3">💬 Add your thought</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {pollOpen && (
              <PollCreator
                seedId={seed.id}
                uploadsEnabled={uploadsEnabled}
                onDone={(next) => {
                  setPollOpen(false);
                  if (next) setPolls(next);
                }}
              />
            )}
            <RichEditor
              value={draft}
              onChange={setDraft}
              placeholder="What's your say?"
              disabled={busy}
              people={seed.people}
              onSubmit={() => {
                if (!busy && !uploading && (draft.trim().length > 0 || draftAttachments.length > 0))
                  contribute();
              }}
              toolbarExtra={
                <>
                <MicButton
                  disabled={busy}
                  onText={(t) => setDraft((d) => (d.trim() ? `${d.trim()} ${t}` : t))}
                />
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
                  aria-label="Attach image, video, or screenshot"
                  className="flex h-7 items-center rounded-md border px-2 text-sm text-ink-mid transition hover:text-ink disabled:opacity-40"
                  style={{ borderColor: "rgba(76,175,80,0.2)" }}
                >
                  {uploading ? "⏳" : <Icon name="attach" size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => setPollOpen((o) => !o)}
                  disabled={busy}
                  title="Create a poll"
                  aria-label="Create a poll"
                  className="flex h-7 items-center rounded-md border px-2 text-sm text-ink-mid transition hover:text-ink disabled:opacity-40"
                  style={{ borderColor: pollOpen ? "rgba(76,175,80,0.5)" : "rgba(76,175,80,0.2)" }}
                >
                  📊
                </button>
                </>
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
                <span className="text-accent">@claude</span> · <span className="text-accent">@chatgpt</span> to ask · <span className="text-accent">@</span> to tag
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
        </>
        )}

        {/* Guided journey — gently point to the next step so nobody needs it
            explained on a call. */}
        {!isBloomed && tab === "discuss" && (
          <StepNudge
            emoji="⚖️"
            title="Talked it through?"
            sub="When you're ready, decide it together — everyone gives their honest read and it adds up to one fair answer."
            cta="Go to Decide →"
            onClick={() => setTab("decide")}
          />
        )}
        {!isBloomed && tab === "decide" && (
          <StepNudge
            emoji="🌸"
            title="Reached a decision?"
            sub="Turn it into a Bloom — a permanent record of what you decided and why, saved for your group forever."
            cta="Go to Bloom →"
            onClick={() => setTab("bloom")}
          />
        )}
        </div>
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
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>

          <div className="p-4">
            {/* Stage status */}
            <div className="mb-2 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs" style={{ color: isBloomed ? "#FFB300" : "#66BB6A" }}>
                {stageMeta.emoji} {stageMeta.label}
              </span>
            </div>
            <p className="mx-auto mb-4 max-w-sm text-center text-xs text-ink-soft">
              Voting shares your read with everyone here — it’s how the group sees whether
              we’re converging or still finding our way. The plant grows to match where most
              people feel it stands.
            </p>

            {/* Community feels */}
            <p className="eyebrow mb-1">
              How ready does this feel?
            </p>
            <p className="mb-3 text-[11px] text-ink-soft">
              {totalVotes} of {quorumSize} {quorumSize === 1 ? "member" : "members"} voted
              {notVoted > 0 && ` · ${notVoted} not yet`}
            </p>
            <div className="space-y-2">
              {STAGES.map((s) => {
                const d = distribution.find((x) => x.stage === s.key)!;
                const mine = myVote === s.key;
                const pct = pctOfQuorum(d.votes);
                return (
                  <button
                    key={s.key}
                    onClick={() => vote(s.key)}
                    disabled={busy || isBloomed}
                    aria-pressed={mine}
                    aria-label={`Vote this seed is at: ${s.label} (${d.votes} of ${quorumSize})`}
                    className="block w-full rounded-xl border p-2 text-left transition disabled:cursor-default"
                    style={{ borderColor: mine ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.06)" }}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span style={{ color: mine ? "#66BB6A" : "#C8C4BC" }}>{s.emoji} {s.label}</span>
                      <span className="text-ink-soft">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.key === "bloomed" ? "linear-gradient(to right,#FFD54F,#FF8F00)" : "#4CAF50", transition: "width 0.6s" }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {notVoted > 0 && !isBloomed && (
              <p className="mt-2 text-center text-[11px] text-ink-soft">
                {notVoted} {notVoted === 1 ? "person hasn’t" : "people haven’t"} weighed in yet — percentages are out of all {quorumSize}.
              </p>
            )}
            {myVote === null && !isBloomed && (
              <p className="mt-2 text-center text-xs italic text-ink-soft">Tap a stage to vote → watch the plant respond</p>
            )}

            {/* Bring the AIs into the quorum — they read the thread and vote too */}
            {!isBloomed && (
              <div className="mt-3">
                <p className="mb-1.5 text-center text-[10px] text-ink-soft">Bring an AI into the quorum</p>
                <div className="flex gap-2">
                  {(["claude", "chatgpt"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => askAIVote(p)}
                      disabled={aiVoting !== null || busy}
                      className="flex-1 rounded-lg border border-[rgba(76,175,80,0.22)] px-2 py-1.5 text-[11px] text-ink-mid transition hover:text-ink disabled:opacity-50"
                    >
                      {aiVoting === p
                        ? "🗳️ voting…"
                        : `🗳️ ${p === "claude" ? "Claude" : "ChatGPT"} vote`}
                    </button>
                  ))}
                </div>
              </div>
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
              <p className="eyebrow mb-2" style={{ color: bloomReady ? "#FFB300" : "#5A6456" }}>🌸 Ready to bloom?</p>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (bloomedVotes / bloomTarget) * 100)}%`, background: bloomReady ? "linear-gradient(to right,#FFD54F,#FF8F00)" : "rgba(255,179,0,0.4)", transition: "width 0.7s" }} />
              </div>
              <p className="mb-1 text-[11px]" style={{ color: bloomReady ? "#FFB300" : "#5A6456" }}>
                {isBloomed
                  ? "🌸 Bloomed — collective knowledge, remembered."
                  : `${bloomedVotes} of ${bloomTarget} people have voted to bloom${
                      bloomNeeded > 0 ? ` — ${bloomNeeded} more to go` : " — ready!"
                    }`}
              </p>
              {!isBloomed && (
                <p className="mb-3 text-[10px] leading-relaxed text-ink-soft">
                  This bar fills as people vote “Bloomed”. At {bloomTarget} votes, the seed blooms into durable knowledge.
                </p>
              )}
              <Requirement met={bloomedVotes >= bloomTarget} label={`${bloomedVotes} of ${bloomTarget} voted to bloom`} />
              <Requirement met={dimsWithContribs >= 3} label={`${dimsWithContribs} of 3 dimensions explored`} />
              {stakeBoard && (stakeBoard.locked || stakeBoard.bloomProgress.configured) && (
                <p className="mt-2 text-[10px] leading-relaxed text-bloom">
                  ⚖️ Final call is stake-weighted — the Decide tab shows whose votes weigh more.
                </p>
              )}
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

            {/* Stake-weighted quorum glance — full board lives in the Quorum tab */}
            {tab !== "decide" && (
              <StakeMap board={stakeBoard} onOpen={() => setTab("decide")} bloomed={isBloomed} />
            )}
          </div>
        </div>
      </aside>

      {/* Message action sheet — tap a message's ⋯ to react or act on it.
          Keeps each message in the thread clean. */}
      {sheetC && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setSheetForId(null)}
          />
          <div
            role="dialog"
            aria-label="Thought actions"
            className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+4.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85vh] sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar name={sheetC.author?.name} image={sheetC.author?.image} size={28} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{sheetC.author?.name || "Someone"}</p>
                  <p className="truncate text-[11px] text-ink-soft">{sheetC.text || "attachment"}</p>
                </div>
              </div>
              <button
                onClick={() => setSheetForId(null)}
                aria-label="Close"
                className="shrink-0 text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Reactions */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {reactions.map((r) => {
                const mine = sheetC.myReactions.includes(r.key);
                const n = sheetC.reactionCounts[r.key] ?? 0;
                return (
                  <button
                    key={r.key}
                    onClick={(e) => react(sheetC.id, r.key, e.currentTarget)}
                    aria-pressed={mine}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 py-1 text-xs transition active:scale-110 ${
                      mine
                        ? "border-accent text-accent"
                        : "border-[rgba(255,255,255,0.1)] text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    <span>{r.label}</span>
                    {n > 0 && <span className="font-medium">· {n}</span>}
                  </button>
                );
              })}
            </div>

            {/* Who reacted — so it's clear on touch (where hover doesn't exist)
                exactly who left each reaction. */}
            {reactions.some((r) => (sheetC.reactionPeople[r.key]?.length ?? 0) > 0) && (
              <div className="mb-3 space-y-1 border-t border-[rgba(255,255,255,0.06)] pt-3 text-xs text-ink-soft">
                {reactions
                  .filter((r) => (sheetC.reactionPeople[r.key]?.length ?? 0) > 0)
                  .map((r) => (
                    <div key={r.key} className="flex items-start gap-2">
                      <span aria-hidden>{r.emoji}</span>
                      <span className="text-ink-mid">
                        {(sheetC.reactionPeople[r.key] ?? []).join(", ")}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Actions — fixed 2-col layout:
                  Copy · Edit
                  Endorse · Share
                  Read aloud · Delete
                (Edit/Delete only on your own message; the rest reflow.) */}
            <div className="grid grid-cols-2 gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3 text-sm">
              {sheetC.text && (
                <MessageActions
                  only="copy"
                  text={sheetC.text}
                  path={`/seeds/${seed.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
                />
              )}
              {sheetC.author?.id === currentUserId && (
                <button
                  onClick={() => {
                    setEditingId(sheetC.id);
                    setEditDraft(deserializeMentions(sheetC.text));
                    setSheetForId(null);
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
                >
                  ✎ Edit
                </button>
              )}
              <button
                onClick={() => endorse(sheetC.id)}
                aria-pressed={sheetC.iEndorsed}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-[rgba(255,255,255,0.04)] ${
                  sheetC.iEndorsed ? "text-bloom" : "text-ink-mid hover:text-ink"
                }`}
              >
                ✦ {sheetC.iEndorsed ? "Endorsed" : "Endorse"}
                {sheetC.endorsementCount > 0 && ` · ${sheetC.endorsementCount}`}
              </button>
              {sheetC.text && (
                <MessageActions
                  only="share"
                  text={sheetC.text}
                  path={`/seeds/${seed.id}#c-${sheetC.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
                />
              )}
              {sheetC.text && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-ink-mid">
                  <ReadAloud text={sheetC.text} />
                </div>
              )}
              {(sheetC.author?.id === currentUserId || seed.canModerate) && (
                <button
                  onClick={() => {
                    removeContribution(sheetC.id);
                    setSheetForId(null);
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[#e57373] transition hover:bg-[rgba(229,115,115,0.08)]"
                >
                  <Icon name="delete" size={14} />{" "}
                  {sheetC.author?.id === currentUserId ? "Delete" : "Remove"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seed details sheet — tap the question/meta to open. Visibility, member
          count, framing, and every seed action in one tidy place. */}
      {seedMenu && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setSeedMenu(false)}
          />
          <div
            role="dialog"
            aria-label="Seed details"
            className="relative z-10 max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+4.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">
                  {visibility === "private" ? "🔒 Private seed" : "🌍 Public seed"} ·{" "}
                  {participants} member{participants === 1 ? "" : "s"}
                </p>
                <h2 className="serif-lg mt-0.5 break-words">{seedTitle}</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  by{" "}
                  {seed.author?.id ? (
                    <Link href={`/u/${seed.author.id}`} className="transition hover:text-accent hover:underline">
                      {seed.author?.name || "someone"}
                    </Link>
                  ) : (
                    seed.author?.name || "someone"
                  )}
                </p>
              </div>
              <button
                onClick={() => setSeedMenu(false)}
                aria-label="Close"
                className="shrink-0 text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {seedContent && (
              <p className="mb-3 rounded-xl bg-[rgba(255,255,255,0.03)] p-3 text-sm text-ink-mid">
                {seedContent}
              </p>
            )}

            {/* Actions — a calm list, no single dominant button. Invite reveals
                its form inline so it doesn't steal the eye. */}
            <div className="grid grid-cols-2 gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3 text-sm">
              <button
                onClick={() => setInviteOpen((v) => !v)}
                aria-expanded={inviteOpen}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
              >
                ➕ Add members
              </button>
              <button
                onClick={() => {
                  setSeedMenu(false);
                  void shareOrCopy({
                    path: `/seeds/${seed.id}`,
                    title: seedTitle,
                    text: `On ThinkThru: ${seedTitle}`,
                  });
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
              >
                📤 Share
              </button>
              {seed.canManage && (
                <button
                  onClick={() => {
                    setSeedMenu(false);
                    setSeedTitleDraft(seedTitle);
                    setSeedContentDraft(seedContent);
                    setEditingSeed(true);
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
                >
                  ✎ Edit question
                </button>
              )}
              {seed.canManage && (
                <button
                  onClick={() => {
                    setSeedMenu(false);
                    toggleVisibility();
                  }}
                  disabled={visBusy}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink disabled:opacity-50"
                >
                  {visibility === "private" ? "🌍 Make public" : "🔒 Make private"}
                </button>
              )}
              {seed.canManage && (
                <button
                  onClick={() => {
                    setSeedMenu(false);
                    toggleListed();
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-[rgba(255,255,255,0.04)] ${
                    listed ? "text-accent" : "text-ink-mid hover:text-ink"
                  }`}
                >
                  {listed ? "🌐 Listed on Explore · unlist" : "🌐 Share with the world"}
                </button>
              )}
              {/* Follow level — for anyone who isn't the owner. Pick how loud:
                  every reply, just the highlights, or off. */}
              {seed.author?.id !== currentUserId && (
                <div className="rounded-lg border border-[rgba(255,255,255,0.08)] p-1">
                  <p className="px-2 pb-1 pt-1.5 text-[11px] uppercase tracking-wide text-ink-soft">
                    Notify me about this seed
                  </p>
                  {(
                    [
                      { key: "all", icon: "🔔", label: "Every reply" },
                      { key: "highlights", icon: "🌿", label: "Highlights only" },
                      { key: "off", icon: "🔕", label: "Off" },
                    ] as const
                  ).map((opt) => {
                    const active = opt.key === "off" ? !following : following && followLevel === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setFollow(opt.key)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-[rgba(255,255,255,0.04)] ${
                          active ? "text-accent" : "text-ink-mid hover:text-ink"
                        }`}
                      >
                        <span aria-hidden>{opt.icon}</span>
                        <span className="flex-1">{opt.label}</span>
                        {active && <span aria-hidden>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => {
                  setSeedMenu(false);
                  setMembersOpen(true);
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
              >
                👥 Members
              </button>
              <button
                onClick={() => {
                  setSeedMenu(false);
                  setShowHelp(true);
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-ink"
              >
                <Icon name="info" size={14} /> How it works
              </button>
              {/* Report — for anyone who isn't the owner (public-square safety) */}
              {seed.author?.id !== currentUserId && (
                <button
                  onClick={() => {
                    setSeedMenu(false);
                    reportSeed();
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-soft transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e57373]"
                >
                  🚩 Report
                </button>
              )}
              {/* Leave — for participants who aren't the owner */}
              {seed.author?.id !== currentUserId && (
                <button
                  onClick={() => {
                    setSeedMenu(false);
                    leaveSeed();
                  }}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-ink-mid transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e57373]"
                >
                  🚪 Leave seed
                </button>
              )}
              {seed.canManage && (
                <button
                  onClick={() => {
                    setSeedMenu(false);
                    removeSeed();
                  }}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[#e57373] transition hover:bg-[rgba(229,115,115,0.08)]"
                >
                  <Icon name="delete" size={14} /> Delete seed
                </button>
              )}
            </div>

            {/* Invite form — revealed only when "Invite people" is tapped */}
            {inviteOpen && (
              <div className="mt-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
                <SeedInvite
                  seedId={seed.id}
                  gardenName={seed.garden.name}
                  isPrivate={visibility === "private"}
                  inline
                />
              </div>
            )}
          </div>
        </div>
      )}

      {membersOpen && <MembersSheet seedId={seed.id} onClose={() => setMembersOpen(false)} />}
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

// A friendly "here's your next step" card — the guided Discuss → Decide → Bloom
// journey, so the flow explains itself.
function StepNudge({
  emoji,
  title,
  sub,
  cta,
  onClick,
}: {
  emoji: string;
  title: string;
  sub: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] p-4 text-center">
      <div className="text-2xl" aria-hidden>{emoji}</div>
      <p className="serif-lg mt-1">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-mid">{sub}</p>
      <button onClick={onClick} className="btn-primary mt-3 text-sm">
        {cta}
      </button>
    </div>
  );
}
