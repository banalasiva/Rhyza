"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import { playNatureSound } from "@/lib/sound";
import { upload } from "@vercel/blob/client";
import { Avatar } from "@/components/Avatar";
import { Attachments, type Attachment } from "@/components/Attachments";
import { timeAgo } from "@/lib/time";

const MAX_POLL_FILE = 25 * 1024 * 1024; // 25 MB

type PollOption = { id: string; text: string; votes: number; pct: number };
type Poll = {
  id: string;
  question: string;
  attachments: Attachment[];
  weightMode: "equal" | "stake";
  stakeActive: boolean;
  closed: boolean;
  isAuthor: boolean;
  author: { id: string; name: string; image: string | null };
  myVote: string | null;
  totalVotes: number;
  createdAt: string;
  options: PollOption[];
};

function attachmentType(mime: string): Attachment["type"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export function SeedPolls({
  seedId,
  uploadsEnabled = false,
}: {
  seedId: string;
  currentUserId: string;
  uploadsEnabled?: boolean;
}) {
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setPolls(await apiGet<Poll[]>(`/api/seeds/${seedId}/polls`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load polls");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId]);

  async function vote(pollId: string, optionId: string) {
    setPolls((prev) =>
      prev?.map((p) => (p.id === pollId ? { ...p, myVote: optionId } : p)) ?? prev,
    );
    playNatureSound("drop");
    try {
      setPolls(await apiPost<Poll[]>(`/api/polls/${pollId}/vote`, { optionId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't vote");
      load();
    }
  }

  async function setClosed(pollId: string, closed: boolean) {
    try {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed }),
      });
      setPolls(await res.json());
    } catch {
      load();
    }
  }

  async function remove(pollId: string) {
    if (!confirm("Delete this poll?")) return;
    try {
      const res = await fetch(`/api/polls/${pollId}`, { method: "DELETE" });
      setPolls(await res.json());
    } catch {
      load();
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="eyebrow">📊 Polls · decide together</p>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary px-3 py-1.5 text-xs">
            + New poll
          </button>
        )}
      </div>

      {creating && (
        <PollCreator
          seedId={seedId}
          uploadsEnabled={uploadsEnabled}
          onDone={(next) => {
            setCreating(false);
            if (next) setPolls(next);
          }}
        />
      )}

      {error && <p className="mb-3 text-sm text-[#e57373]">{error}</p>}

      {polls === null ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : polls.length === 0 && !creating ? (
        <div className="card p-6 text-center">
          <div className="mb-2 text-3xl">📊</div>
          <p className="mb-1 text-sm text-ink">No polls yet.</p>
          <p className="text-xs text-ink-soft">
            Create one to gauge the room — equal votes, or weighted by who carries the decision.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              onVote={vote}
              onClose={setClosed}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PollCard({
  poll,
  onVote,
  onClose,
  onDelete,
}: {
  poll: Poll;
  onVote: (pollId: string, optionId: string) => void;
  onClose: (pollId: string, closed: boolean) => void;
  onDelete: (pollId: string) => void;
}) {
  const leader = Math.max(0, ...poll.options.map((o) => o.pct));
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{poll.question}</h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
          style={{
            color: poll.weightMode === "stake" ? "#FFB300" : "#66BB6A",
            background: poll.weightMode === "stake" ? "rgba(255,179,0,0.12)" : "rgba(76,175,80,0.12)",
          }}
          title={
            poll.weightMode === "stake"
              ? poll.stakeActive
                ? "Votes weighted by decision-maker stake"
                : "Stake-weighted — falls back to equal until the stake map exists"
              : "Each person, one vote"
          }
        >
          {poll.weightMode === "stake" ? "⚖️ Stake-weighted" : "👤 Equal"}
        </span>
      </div>
      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-soft">
        <Avatar name={poll.author.name} image={poll.author.image} size={16} />
        {poll.author.name} · {timeAgo(poll.createdAt)} · {poll.totalVotes} vote
        {poll.totalVotes === 1 ? "" : "s"}
        {poll.closed && " · 🔒 closed"}
      </p>

      {poll.attachments.length > 0 && <Attachments items={poll.attachments} />}

      <div className="space-y-2">
        {poll.options.map((o) => {
          const mine = poll.myVote === o.id;
          const winning = o.pct === leader && o.pct > 0;
          return (
            <button
              key={o.id}
              onClick={() => !poll.closed && onVote(poll.id, o.id)}
              disabled={poll.closed}
              aria-pressed={mine}
              aria-label={`${o.text} — ${o.pct}%${mine ? ", your vote" : ""}`}
              className="relative block w-full overflow-hidden rounded-xl border p-2.5 text-left transition disabled:cursor-default"
              style={{ borderColor: mine ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.08)" }}
            >
              {/* result fill */}
              <div
                className="weight-bar-fill absolute inset-y-0 left-0 rounded-xl"
                style={{
                  width: `${o.pct}%`,
                  background: winning ? "rgba(255,179,0,0.16)" : "rgba(76,175,80,0.12)",
                }}
              />
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-ink">
                  {mine && <span className="text-accent">✓</span>}
                  {o.text}
                </span>
                <span className="text-xs text-ink-soft">
                  {o.pct}%
                  {o.votes > 0 && <span className="ml-1 opacity-60">· {o.votes}</span>}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {poll.isAuthor && (
        <div className="mt-3 flex gap-3 text-[11px] text-ink-soft">
          <button onClick={() => onClose(poll.id, !poll.closed)} className="transition hover:text-ink">
            {poll.closed ? "🔓 Reopen" : "🔒 Close"}
          </button>
          <button onClick={() => onDelete(poll.id)} className="transition hover:text-[#e57373]">
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}

function PollCreator({
  seedId,
  uploadsEnabled,
  onDone,
}: {
  seedId: string;
  uploadsEnabled: boolean;
  onDone: (next: Poll[] | null) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [weightMode, setWeightMode] = useState<"equal" | "stake">("equal");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_POLL_FILE) {
          setError(`"${file.name}" is over 25 MB — please attach a smaller file.`);
          continue;
        }
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        setAttachments((prev) => [...prev, { url: blob.url, type: attachmentType(file.type), name: file.name }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function create() {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 3 || opts.length < 2) {
      setError("Add a question and at least two options.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await apiPost<Poll[]>(`/api/seeds/${seedId}/polls`, {
        question: question.trim(),
        options: opts,
        weightMode,
        attachments,
      });
      playNatureSound("chirp");
      onDone(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create poll");
      setBusy(false);
    }
  }

  return (
    <div className="card mb-4 p-4">
      <input
        className="input mb-3"
        placeholder="Ask a question…"
        aria-label="Poll question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        autoFocus
      />
      <div className="mb-3 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input py-2"
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              value={o}
              onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {options.length > 2 && (
              <button
                onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                className="text-ink-soft hover:text-[#e57373]"
                title="Remove option"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="text-xs text-ink-mid underline hover:text-ink"
          >
            + add option
          </button>
        )}
      </div>

      {/* Attachments (images / videos, ≤ 25 MB) */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-3">
        <button
          type="button"
          onClick={() =>
            uploadsEnabled
              ? fileRef.current?.click()
              : setError("Attachments aren't enabled yet — connect a Vercel Blob store, then redeploy.")
          }
          disabled={busy || uploading}
          className="flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.2)] px-3 py-1.5 text-xs text-ink-mid transition hover:text-ink disabled:opacity-40"
        >
          {uploading ? "⏳ Uploading…" : "📎 Add image / video"}
          <span className="text-ink-soft">· ≤ 25 MB</span>
        </button>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.5)] px-2 py-1 text-xs text-ink-mid"
              >
                <span>{a.type === "image" ? "🖼️" : a.type === "video" ? "🎬" : "📎"}</span>
                <span className="max-w-[140px] truncate">{a.name || "file"}</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="text-ink-soft hover:text-[#e57373]"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weighting mode */}
      <p className="mb-2 text-xs text-ink-soft">How should votes count?</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {([
          { key: "equal", label: "👤 Equal", note: "One person, one vote" },
          { key: "stake", label: "⚖️ Stake-weighted", note: "By decision-maker weight" },
        ] as const).map((m) => (
          <button
            key={m.key}
            onClick={() => setWeightMode(m.key)}
            aria-pressed={weightMode === m.key}
            className="rounded-xl border p-2.5 text-left transition"
            style={{
              borderColor: weightMode === m.key ? "rgba(76,175,80,0.5)" : "rgba(255,255,255,0.08)",
              background: weightMode === m.key ? "rgba(76,175,80,0.06)" : "transparent",
            }}
          >
            <p className="text-sm text-ink">{m.label}</p>
            <p className="text-[11px] text-ink-soft">{m.note}</p>
          </button>
        ))}
      </div>

      {error && <p className="mb-2 text-sm text-[#e57373]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy} className="btn-primary text-sm">
          {busy ? "Creating…" : "Create poll"}
        </button>
        <button onClick={() => onDone(null)} disabled={busy} className="btn-ghost text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
