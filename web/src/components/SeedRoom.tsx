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
import { compressImage } from "@/lib/image-compress";
import { isSignalReaction } from "@/lib/reactions";
import { PlantSvg } from "@/components/PlantSvg";
import { HowItWorks } from "@/components/HowItWorks";
import { RichEditor } from "@/components/RichEditor";
import { InlineText } from "@/components/InlineText";
import { serializeMentions, deserializeMentions } from "@/lib/mentions";
import { shareOrCopy } from "@/lib/share-client";
import { CollapsibleText } from "@/components/CollapsibleText";
import { Avatar } from "@/components/Avatar";
import { Attachments, type Attachment } from "@/components/Attachments";
import { type Board } from "@/components/StakeBoard";
import { PollCard, PollCreator, type Poll } from "@/components/SeedPolls";
import { QuorumV2 } from "@/components/QuorumV2";
import { Icon, type IconName } from "@/components/Icon";
import { ReadAloud } from "@/components/ReadAloud";
import { MicButton } from "@/components/MicButton";
import { MessageActions } from "@/components/MessageActions";
import { SeedInvite } from "@/components/SeedInvite";
import { MembersSheet } from "@/components/MembersSheet";
import { AskPeople } from "@/components/AskPeople";
import { JoinRequests } from "@/components/JoinRequests";

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
  const [peopleModal, setPeopleModal] = useState(false); // the fresh-seed "bring your people in" flow
  const [editingSeed, setEditingSeed] = useState(false);
  const [seedTitleDraft, setSeedTitleDraft] = useState(seed.title);
  const [seedContentDraft, setSeedContentDraft] = useState(seed.content);
  // Which message's action sheet is open (reactions + edit/copy/share/…).
  const [sheetForId, setSheetForId] = useState<string | null>(null);
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  const [retagId, setRetagId] = useState<string | null>(null); // open re-tag menu
  // Initial draft = the server copy the page loaded with (SSR-safe). A newer
  // LOCAL draft (offline-first) overrides it on mount, below.
  const [draft, setDraft] = useState(seed.draft?.text ?? "");
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>(
    (seed.draft?.attachments ?? []) as Attachment[],
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ── Draft persistence — a typed-but-unsent message survives refresh, backpress,
  // a mid-type deploy, or going offline. localStorage is the instant offline-first
  // copy that autofills the editor; a debounced server copy powers the "drafts"
  // list in notifications + cross-device. Cleared the moment a message is sent.
  const draftKey = `draft:${seed.id}`;
  const draftDirty = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLatest = useRef({ text: draft, attachments: draftAttachments });
  draftLatest.current = { text: draft, attachments: draftAttachments };

  // Reliable Claude opener. The plant route fires kickstartSeed fire-and-forget,
  // but a serverless instance can freeze right after returning the response and
  // drop that work — leaving a fresh seed silent, the worst first-five-minutes
  // experience. So when the room opens on an empty thread, we (re)trigger the
  // opener from the client. The endpoint is idempotent (only acts on an empty
  // thread, only ever posts one Claude opener), so this can never double-post;
  // the next sync poll surfaces Claude's message when it lands.
  const kickstartFired = useRef(false);
  useEffect(() => {
    if (kickstartFired.current) return;
    if (contributions.length > 0) return; // already opened / has replies
    kickstartFired.current = true;
    void fetch(`/api/seeds/${seed.id}/kickstart`, { method: "POST" }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.id]);

  // On open, a newer LOCAL draft (this device) wins over the loaded server copy.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { text?: string; attachments?: Attachment[] };
      if ((d.text && d.text.trim()) || (d.attachments && d.attachments.length)) {
        setDraft(d.text ?? "");
        setDraftAttachments(d.attachments ?? []);
      }
    } catch {
      /* localStorage unavailable — the server draft (initial state) still shows */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.id]);

  // Persist on every change: localStorage instantly (offline), server debounced.
  useEffect(() => {
    if (!draftDirty.current) {
      draftDirty.current = true; // skip the initial mount value (nothing to save)
      return;
    }
    const payload = { text: draft, attachments: draftAttachments };
    try {
      if (draft.trim() || draftAttachments.length) localStorage.setItem(draftKey, JSON.stringify(payload));
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      void fetch(`/api/seeds/${seed.id}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, draftAttachments]);

  // On tab-hide / navigate-away, flush the pending debounce with keepalive so the
  // last keystrokes reach the server even if they refresh right after typing.
  useEffect(() => {
    const flush = () => {
      if (!draftDirty.current) return;
      const { text, attachments } = draftLatest.current;
      if (!text.trim() && attachments.length === 0) return;
      try {
        fetch(`/api/seeds/${seed.id}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, attachments }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.id]);

  // Clear the draft everywhere the moment a message is actually sent.
  function clearDraftEverywhere() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    void fetch(`/api/seeds/${seed.id}/draft`, { method: "DELETE" }).catch(() => {});
  }
  const tabsRef = useRef<HTMLDivElement>(null); // scroll target when switching tabs
  const threadEndRef = useRef<HTMLDivElement>(null); // scroll target for the latest message
  const tabsMounted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blooming, setBlooming] = useState(false);
  const [bloomPending, setBloomPending] = useState(false); // request in flight, before the celebration
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
  const [followLevel, setFollowLevelState] = useState<string>(seed.followLevel ?? "all");
  const [bloomConfirm, setBloomConfirm] = useState(false); // confirm modal open
  const [previewBloom, setPreviewBloom] = useState(false); // flower the plant as a preview
  const [bursts, setBursts] = useState<
    {
      id: number;
      emoji: string;
      x: number;
      y: number;
      dx: number;
      dy: number;
      rot: number;
      scale: number;
      delay: number;
    }[]
  >([]);
  const [labelFx, setLabelFx] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const burstId = useRef(0);
  const [showHelp, setShowHelp] = useState(false);
  // "Added by someone outside your circle" heads-up — hidden the moment you act
  // on it; the dismiss also clears it server-side so it won't return elsewhere.
  const [noticeHidden, setNoticeHidden] = useState(false);
  // The wise presence's live offer, sensed server-side and delivered to every
  // screen via the sync poll. When set, the presence glows and asks to step in.
  const [nudge, setNudge] = useState<{ mode: "peace" | "guide"; reason: string } | null>(null);

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
      if (typeof document !== "undefined" && document.hidden) return;
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
      if (typeof document !== "undefined" && document.hidden) return;
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
  // Incremental sync: the last thread fingerprint we saw, and a poll counter so
  // we periodically force a full refresh (ignoring the fingerprint) as a
  // self-healing safety net in case a delta was ever missed.
  const syncVersionRef = useRef<string | null>(null);
  const syncPollCountRef = useRef(0);
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
      // Don't poll a backgrounded tab — mobile PWAs sit hidden for long stretches,
      // and this is the heaviest poll. Resumes the moment the tab is visible again.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        // Send our last fingerprint so the server can skip the heavy thread fetch
        // when nothing changed. Every 6th poll (~24s) we force a full refresh
        // (omit `since`) so any missed delta self-heals within seconds.
        syncPollCountRef.current += 1;
        const forceFull = syncPollCountRef.current % 6 === 0;
        const sinceQ =
          !forceFull && syncVersionRef.current
            ? `?since=${encodeURIComponent(syncVersionRef.current)}`
            : "";
        const res = await fetch(`/api/seeds/${seed.id}/sync${sinceQ}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const snap = json as
          | {
              version?: string;
              contributions: Contribution[] | null;
              distribution: typeof distribution;
              stage: string;
              myVote: string | null;
              mediatorNudge?: { mode: "peace" | "guide"; reason: string } | null;
            }
          | undefined;
        if (!snap) return;

        if (snap.version) syncVersionRef.current = snap.version;

        // The presence's live offer, sensed server-side — shown to everyone.
        setNudge(snap.mediatorNudge ?? null);

        // The cheap live bits are always fresh; apply them every poll.
        setDistribution(snap.distribution);
        if (!pendingRef.current.has("__vote__")) {
          setStage(snap.stage);
          setMyVote(snap.myVote);
        }

        // Thread unchanged since our last fingerprint → no contributions body to
        // merge. Skip the whole reconcile (the big win: no re-processing the
        // entire thread every 4s when nothing was said).
        if (snap.contributions == null) return;
        const incoming = snap.contributions;

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
          for (const s of incoming) {
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
    const AI = new Set(["Claude", "ChatGPT"]);
    const ids = new Set<string>();
    if (seed.author?.id && !AI.has(seed.author?.name ?? "")) ids.add(seed.author.id);
    for (const c of contributions) {
      if (c.author?.id && !AI.has(c.author?.name ?? "")) ids.add(c.author.id);
    }
    return Math.max(ids.size, 1);
  }, [contributions, seed.author]);

  // The readiness bars are read against the whole quorum (everyone in the
  // conversation, AI included), NOT just the people who've voted — so two
  // votes out of six reads as 33%, not 50%, and the rest shows as "not yet."
  const quorumSize = Math.max(participants, totalVotes, 1);
  const notVoted = Math.max(0, quorumSize - totalVotes);
  const pctOfQuorum = (votes: number) => Math.round((votes / quorumSize) * 100);

  const dimsWithContribs = useMemo(
    () => new Set(contributions.filter((c) => c.dimension !== "system").map((c) => c.dimension)).size,
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
      // Compress each image on-device (WhatsApp-style), then upload them ALL in
      // parallel — so N photos take about as long as the single slowest one,
      // not the sum. Each attachment appears the moment its own upload lands.
      await Promise.all(
        Array.from(files).map(async (file) => {
          const toSend = await compressImage(file);
          const blob = await upload(toSend.name, toSend, {
            access: "public",
            handleUploadUrl: "/api/upload",
          });
          setDraftAttachments((prev) => [
            ...prev,
            { url: blob.url, type: attachmentType(toSend.type), name: file.name },
          ]);
        }),
      );
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
    clearDraftEverywhere();
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
      if (replies.length) playNatureSound("chime"); // Claude/ChatGPT replied
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

  // The wise presence — dove (peace) when it's getting rough, star (guide) when
  // the thinking's drifting. One tap invites Claude in with the right voice.
  const [presenceMode, setPresenceMode] = useState<"peace" | "guide" | null>(null);
  async function invokePresence(mode: "peace" | "guide") {
    if (presenceMode) return;
    setPresenceMode(mode);
    setNudge(null); // accepting the offer clears it for everyone
    setError(null);
    try {
      const c = await apiPost<ContributionResponse>(`/api/seeds/${seed.id}/mediate`, {
        provider: "claude",
        mode,
      });
      setContributions((prev) => [...prev, hydrate(c)]);
      playNatureSound(mode === "peace" ? "wind" : "chime");
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 120);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The presence couldn't come just now.");
    } finally {
      setPresenceMode(null);
    }
  }

  // "Not now" — clear the offer for everyone without inviting the presence in.
  function dismissNudge() {
    setNudge(null);
    void fetch(`/api/seeds/${seed.id}/mediator/dismiss`, { method: "POST" }).catch(() => {});
  }

  async function askMediate(provider: "claude" | "chatgpt") {
    setMediating(true);
    setMediatingWho(provider);
    setError(null);
    try {
      const c = await apiPost<ContributionResponse>(`/api/seeds/${seed.id}/mediate`, { provider });
      setContributions((prev) => [...prev, hydrate(c)]);
      playNatureSound("chime"); // an AI mediated
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
      playNatureSound("chime"); // an AI summarized
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

  // "I'm happy to be here" — hide immediately, clear server-side best-effort.
  function dismissNotice() {
    setNoticeHidden(true);
    void fetch(`/api/seeds/${seed.id}/notice`, { method: "DELETE" }).catch(() => {});
  }

  function spawnBurst(emoji: string, x: number, y: number) {
    const id = ++burstId.current;
    // A little cluster of the emoji springs up and fans out — varied angle,
    // rise, spin, scale and a touch of stagger so it feels alive, not uniform.
    const N = 8;
    const particles = Array.from({ length: N }).map((_, i) => {
      const angle = -Math.PI / 2 + (i / (N - 1) - 0.5) * (Math.PI * 0.85); // fan upward
      const dist = 46 + Math.random() * 46;
      return {
        id: id * 100 + i,
        emoji,
        x,
        y,
        dx: Math.round(Math.cos(angle) * dist),
        dy: Math.round(Math.sin(angle) * dist - 18), // bias upward
        rot: Math.round(Math.random() * 140 - 70),
        scale: 0.8 + Math.random() * 0.9,
        delay: Math.round(Math.random() * 90),
      };
    });
    setBursts((b) => [...b, ...particles]);
    setTimeout(() => setBursts((b) => b.filter((p) => Math.floor(p.id / 100) !== id)), 1100);
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
    if (
      !confirm(
        "Bloom this seed now? This closes the conversation into a shared decision, kept in your Sacred Tree. You can reopen it anytime.",
      )
    )
      return;
    setBusy(true);
    setBloomPending(true); // show a loading state instantly — synthesis takes a few seconds
    try {
      const res = await fetch(`/api/seeds/${seed.id}/bloom`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to bloom");
      triggerBloom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bloom");
      setBusy(false);
      setBloomPending(false);
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
    // If this vote is the one that tips the seed over the bloom threshold, the
    // server runs synthesis right now — show the loading state instantly so the
    // tipping voter isn't left staring at a still screen. (Non-tipping votes
    // return fast and skip this, so there's no flicker.)
    if (bloomedVotes + 1 >= bloomTarget) setBloomPending(true);
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
        // Not enough bloom votes yet — drop the preview back to the real stage
        // and clear any loading state (our tip prediction was off, e.g. a vote
        // changed underneath us).
        setPreviewBloom(false);
        setBloomPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
      setPreviewBloom(false);
      setBloomPending(false);
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
      {/* Added by someone outside your circle → a gentle, dismissible heads-up
          with a one-tap way out. Open discoverability, but never a trap. */}
      {seed.addedNotice && !noticeHidden && (
        <div className="lg:col-span-2 rounded-xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.07)] px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-sm">👋</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{seed.addedNotice.byName}</span> added you here — someone
                you haven’t connected with yet. Happy to be here, or would you like to leave?
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={leaveSeed}
                  disabled={busy}
                  className="rounded-full border border-[rgba(255,255,255,0.15)] px-3 py-1 text-xs text-ink-mid transition hover:border-[#e57373] hover:text-ink disabled:opacity-50"
                >
                  Leave this seed
                </button>
                <button
                  onClick={dismissNotice}
                  className="rounded-full px-3 py-1 text-xs text-accent transition hover:bg-[rgba(76,175,80,0.12)]"
                >
                  I’m happy to be here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
          style={
            {
              left: b.x,
              top: b.y,
              ["--dx" as string]: `${b.dx}px`,
              ["--dy" as string]: `${b.dy}px`,
              ["--rot" as string]: `${b.rot}deg`,
              ["--scale" as string]: b.scale,
              animationDelay: `${b.delay}ms`,
            } as React.CSSProperties
          }
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

      {/* Instant feedback the moment bloom is triggered — synthesis takes a few
          seconds, so never leave the tap feeling like nothing happened. */}
      {bloomPending && !blooming && (
        <div className="fixed inset-0 z-[190] flex flex-col items-center justify-center bg-[rgba(20,10,0,0.85)] px-6 text-center backdrop-blur">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-bloom border-t-transparent" />
          <p className="serif-lg mt-4 text-bloom">Blooming your decision…</p>
          <p className="mt-1 text-sm text-ink-mid">Weaving the thread into a keepsake — just a moment.</p>
        </div>
      )}

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
                How does everyone see it? Give your honest read below, and it adds up to one fair
                answer for the group.
              </p>
              {/* Weighing is optional — say so plainly, so no one feels stuck
                  here when they've already agreed. */}
              <p className="mt-2 rounded-lg bg-[rgba(255,255,255,0.04)] px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
                Weighing whose voice counts most is <span className="text-ink">optional</span> — reach
                for it on tough or contested calls. Already agreed?{" "}
                <button onClick={() => setTab("bloom")} className="font-medium text-bloom underline-offset-2 hover:underline">
                  Go straight to 🌸 Bloom
                </button>
                .
              </p>
              {/* More voices make a fairer decision — invite the people who
                  should weigh in, right where the deciding happens. */}
              <div className="mt-3 flex items-center gap-2 border-t border-[rgba(76,175,80,0.15)] pt-3">
                <span className="text-xs text-ink-soft">Want more voices on this?</span>
                <AskPeople seedId={seed.id} />
              </div>
            </div>
            <QuorumV2 seedId={seed.id} />
          </div>
        ) : tab === "bloom" ? (
          <div className="space-y-4">
            {isBloomed ? (
              <div className="rounded-2xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.08)] p-5 text-center">
                <div className="mb-1 text-3xl">🌸</div>
                <p className="serif-lg mb-1">You decided it together 🌸</p>
                <p className="mb-3 text-xs text-ink-mid">It's kept in your Sacred Tree, forever.</p>
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
            <p className="serif-lg mb-1">You decided it together 🌸</p>
            <p className="mb-3 text-xs text-ink-mid">It's kept in your Sacred Tree, forever.</p>
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
            💬 What’s on your mind? A thought, a question, even a worry — share it, and the others
            will weigh in.
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
          {/* The flywheel moment: while you're still the only person here, make
              bringing your people in the obvious next step — ThinkThru's whole
              point is deciding *together*, not alone with a bot. */}
          {seed.people.filter((p) => p.id !== currentUserId).length === 0 && (
            <div className="rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.06)] p-4 text-center">
              <p className="text-sm font-semibold text-ink">👨‍👩‍👧 Better with your people</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-ink-mid">
                Claude’s in — now bring the folks who should decide this with you. That’s where it
                comes alive.
              </p>
              <button onClick={() => setPeopleModal(true)} className="btn-primary mt-3 text-sm">
                ✨ Bring your people in
              </button>
            </div>
          )}
          {timeline.length === 0 && (
            <p className="text-sm text-ink-soft">🌱 Claude is reading your question — a first thought lands in a moment…</p>
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
            // System "joined" line — a quiet, centered presence marker, not a
            // message bubble.
            if (c.dimension === "system") {
              // A quiet, centered presence marker. Custom text (e.g. a timer
              // note) shows verbatim; otherwise it's a join line.
              const sysText = c.text?.trim();
              return (
                <div key={c.id} id={`c-${c.id}`} className="scroll-mt-20 py-1 text-center text-xs text-ink-soft">
                  {sysText ? sysText : `🌿 ${c.author?.name || "Someone"} joined the conversation`}
                </div>
              );
            }
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

        {/* The wise presence — a calm candle at the foot of the conversation.
            Turn to it when it's getting heated (the dove), or when the thinking
            has drifted (the star). One tap; it never takes a side. */}
        {/* The presence has SENSED something and is quietly offering — shown to
            everyone via the live sync. Anyone can accept; one yes brings it in. */}
        {!isBloomed && nudge && !presenceMode && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-center ${
              nudge.mode === "peace"
                ? "border-[rgba(226,232,240,0.28)] bg-[rgba(226,232,240,0.05)]"
                : "border-[rgba(255,179,0,0.32)] bg-[rgba(255,179,0,0.05)]"
            }`}
          >
            <span className={`orb ${nudge.mode === "peace" ? "dove" : "star"} is-calling mx-auto mb-2`}>
              {nudge.mode === "peace" ? "🕊️" : "🌟"}
            </span>
            <p className="text-sm text-ink">
              {nudge.mode === "peace"
                ? "This feels like it's getting heated. Shall I step in to help you find peace?"
                : "One thing seems worth a closer look. Shall I offer a clearer view?"}
            </p>
            {nudge.reason && <p className="mt-0.5 text-[11px] italic text-ink-soft">{nudge.reason}</p>}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={() => invokePresence(nudge.mode)}
                className="btn-primary px-4 py-1.5 text-sm"
              >
                Yes, please
              </button>
              <button onClick={dismissNudge} className="btn-ghost px-3 py-1.5 text-xs">
                Not now
              </button>
            </div>
          </div>
        )}

        {!isBloomed && contributions.length >= 2 && (
          <div className="presence mt-5 flex flex-col items-center gap-2 py-2">
            <p className="text-[11px] text-ink-soft">
              {presenceMode === "peace"
                ? "A dove is on its way…"
                : presenceMode === "guide"
                  ? "Lighting a clearer view…"
                  : "If it would help, invite a gentle presence"}
            </p>
            <div className="flex items-center gap-5">
              <button
                onClick={() => invokePresence("peace")}
                disabled={!!presenceMode}
                aria-label="Help us find peace"
                title="Help us find peace"
                className="presence-orb group flex flex-col items-center gap-1 disabled:opacity-60"
              >
                <span className={`orb dove ${presenceMode === "peace" ? "is-calling" : ""}`}>🕊️</span>
                <span className="text-[11px] text-ink-soft transition group-hover:text-ink">Find peace</span>
              </button>
              <button
                onClick={() => invokePresence("guide")}
                disabled={!!presenceMode}
                aria-label="Help us see clearly"
                title="Help us see clearly"
                className="presence-orb group flex flex-col items-center gap-1 disabled:opacity-60"
              >
                <span className={`orb star ${presenceMode === "guide" ? "is-calling" : ""}`}>🌟</span>
                <span className="text-[11px] text-ink-soft transition group-hover:text-ink">See clearly</span>
              </button>
            </div>
          </div>
        )}

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
              placeholder="What do you think? Share it here…"
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
                  className="relative flex h-7 items-center rounded-md border px-2 text-sm text-ink-mid transition hover:text-ink disabled:opacity-40"
                  style={{ borderColor: "rgba(76,175,80,0.2)" }}
                >
                  {/* Keep the pin ALWAYS visible so it never looks like it
                      vanished mid-upload; a small pulsing dot signals progress. */}
                  <Icon name="attach" size={15} />
                  {uploading && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-accent" />
                  )}
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
            {(draftAttachments.length > 0 || uploading) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {uploading && (
                  <div className="flex items-center gap-2 rounded-lg border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.5)] px-2 py-1 text-xs text-ink-mid">
                    <span className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
                    <span>Compressing &amp; uploading…</span>
                  </div>
                )}
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
              Your move: vote to tell everyone whether this conversation is
              <span style={{ color: "#66BB6A" }}> moving forward</span> or
              <span style={{ color: "#EF9A9A" }}> slipping back</span>. The plant grows to match
              where the group stands — and everyone here is notified when you do.
            </p>

            {/* Community feels */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="eyebrow">How ready does this feel?</p>
              {myVote === null && !isBloomed && (
                <span className="rounded-full bg-[rgba(76,175,80,0.15)] px-2 py-0.5 text-[10px] font-medium" style={{ color: "#66BB6A" }}>
                  your move
                </span>
              )}
            </div>
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
              <p className="mt-2 text-center text-xs italic text-ink-soft">Tap a stage to share where you feel it stands — everyone will be notified</p>
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

            {/* Ready-to-bloom and stake weighting used to live here too, but they
                already have their own Bloom and Decide tabs — no need to repeat
                them under every chat. This rail stays focused on one action:
                vote your read and watch the plant respond. */}
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
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar name={sheetC.author?.name} image={sheetC.author?.image} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{sheetC.author?.name || "Someone"}</p>
                  {/* Preview only — this sheet is for reacting/acting, not
                      re-reading. Clamp to 2 lines so a long thought can't grow
                      the card past the screen and push the ✕ out of reach. */}
                  <p className="line-clamp-2 text-[11px] text-ink-soft">{sheetC.text || "attachment"}</p>
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

            {/* Reactions — SIGNAL (a labelled read the group + AI use) first,
                then EXPRESSIVE (warmth, animated, excluded from the quorum). */}
            {(() => {
              const reactBtn = (r: ReactionType) => {
                const mine = sheetC.myReactions.includes(r.key);
                const n = sheetC.reactionCounts[r.key] ?? 0;
                const expressive = !isSignalReaction(r.key);
                return (
                  <button
                    key={r.key}
                    onClick={(e) => react(sheetC.id, r.key, e.currentTarget)}
                    aria-pressed={mine}
                    aria-label={r.label}
                    className={`reaction-chip inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 py-1 text-xs transition active:scale-125 ${
                      mine
                        ? "border-accent text-accent"
                        : "border-[rgba(255,255,255,0.1)] text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span aria-hidden className="text-sm">{r.emoji}</span>
                    {/* Expressive reactions are emoji-forward; hide the label so
                        the row reads as a quick emotional palette, not more text. */}
                    {!expressive && <span>{r.label}</span>}
                    {n > 0 && <span className="font-medium">· {n}</span>}
                  </button>
                );
              };
              const signal = reactions.filter((r) => isSignalReaction(r.key));
              const expressive = reactions.filter((r) => !isSignalReaction(r.key));
              return (
                <>
                  {signal.length > 0 && (
                    <>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                        How it landed
                      </p>
                      <div className="mb-3 flex flex-wrap gap-1.5">{signal.map(reactBtn)}</div>
                    </>
                  )}
                  {expressive.length > 0 && (
                    <>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                        React
                      </p>
                      <div className="mb-3 flex flex-wrap gap-1.5">{expressive.map(reactBtn)}</div>
                    </>
                  )}
                </>
              );
            })()}

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

            {/* People knocking to join this private seed — owner/stewards act here. */}
            {seed.canManage && visibility === "private" && <JoinRequests seedId={seed.id} />}

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
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-[rgba(255,255,255,0.04)] ${
                    listed ? "text-accent" : "text-ink-mid hover:text-ink"
                  }`}
                >
                  <span aria-hidden className="mt-0.5">🌐</span>
                  <span className="min-w-0">
                    {listed ? (
                      <>
                        <span className="block text-sm font-medium">Shared with the world</span>
                        <span className="block text-xs text-ink-soft">
                          Anyone on ThinkThru can find and join this. Tap to make it private again.
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block text-sm font-medium">Share with the world</span>
                        <span className="block text-xs text-ink-soft">
                          Let anyone on ThinkThru discover this and join in.
                        </span>
                      </>
                    )}
                  </span>
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

      {/* Fresh-seed "bring your people in" — the same add/invite flow, front and
          centre in its own sheet so the flywheel step is one tap, not buried. */}
      {peopleModal && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setPeopleModal(false)}
          />
          <div
            role="dialog"
            aria-label="Bring your people in"
            className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.25)] bg-[#0B120B] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">👨‍👩‍👧 Bring your people in</h2>
              <button
                onClick={() => setPeopleModal(false)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <SeedInvite
              seedId={seed.id}
              gardenName={seed.garden.name}
              isPrivate={visibility === "private"}
              inline
            />
          </div>
        </div>
      )}
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
  // A big, festive fall: emoji confetti (party poppers, round flowers, balloons,
  // sparkles, stars, ribbons) mixed with soft CSS petals raining down.
  const EMOJI = ["🎉", "🎊", "🎈", "✨", "🌟", "🎀", "🌸", "🌺", "💐", "💫", "🏵️", "🌼"];
  const PETAL = ["#FFC1CC", "#FFD98A", "#FF9FB0", "#FFE0B2"];
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        isEmoji: i % 4 !== 0, // ~75% festive emoji, ~25% soft petals
        char: EMOJI[i % EMOJI.length],
        color: PETAL[i % PETAL.length],
        left: Math.round(Math.random() * 100), // launch from anywhere along the bottom
        delay: Math.random() * 2.6,
        dur: 2.6 + Math.random() * 2.2, // quicker = more energetic
        size: 16 + Math.round(Math.random() * 22),
        drift: `${(Math.random() * 220 - 110).toFixed(0)}px`, // sideways spread as it flies up
        rise: `-${(72 + Math.random() * 34).toFixed(0)}vh`, // how high it shoots
        spin: `${Math.round(Math.random() * 900 - 450)}deg`,
        rot: Math.round(Math.random() * 360),
      })),
    [],
  );
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-6 text-center"
      // Fully OPAQUE warm backdrop — nothing behind bleeds through.
      style={{ background: "radial-gradient(circle at 50% 44%, #241300 0%, #0A0600 68%)" }}
    >
      {/* big, warm celebration glow behind the plant */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="celebrate-glow" />
      </div>

      {/* festive burst — party poppers, flowers, confetti + soft petals shooting
          UP from the bottom (energetic), not drifting down. */}
      <div className="pointer-events-none absolute inset-0">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="celebrate-rise"
            style={{
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              ["--drift" as string]: c.drift,
              ["--rise" as string]: c.rise,
              ["--spin" as string]: c.spin,
            } as React.CSSProperties}
          >
            {c.isEmoji ? (
              <span style={{ fontSize: c.size, display: "inline-block", transform: `rotate(${c.rot}deg)` }}>
                {c.char}
              </span>
            ) : (
              <span
                className="petal-shape"
                style={{
                  width: Math.round(c.size * 0.5),
                  height: Math.round(c.size * 0.7),
                  background: `linear-gradient(135deg, ${c.color}, rgba(255,255,255,0.25))`,
                  transform: `rotate(${c.rot}deg)`,
                }}
              />
            )}
          </span>
        ))}
      </div>

      <div className="relative animate-[fadeUp_0.8s_ease-out]">
        {/* The plant — bigger for the celebration, with a soft halo ring around
            it. Its bloom bulb + glow come from PlantSvg; the big warm glow behind
            is celebrate-glow. */}
        <div className="relative mx-auto mb-2 h-56 w-56">
          <span className="bloom-halo-ring" />
          <PlantSvg stage={4} />
        </div>
        <p className="eyebrow mb-2 text-bloom">✨ You decided it together 🌸 ✨</p>
        <h2 className="serif-lg mx-auto max-w-md bloom-shimmer">{title}</h2>
        <p className="mt-3 text-sm text-ink-mid">
          You decided this together — and it’s yours to keep, forever. 🌸
        </p>
        <button onClick={onEnter} className="btn-primary mt-5 animate-pulse">
          See where it’s kept →
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
