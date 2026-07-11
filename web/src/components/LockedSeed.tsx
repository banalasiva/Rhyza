"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

type Preview = {
  id: string;
  title: string;
  garden: { id: string; name: string; emoji: string } | null;
  memberCount: number;
  status: "none" | "pending" | "declined" | "member";
};

// What someone sees when they open a PRIVATE seed link they're not in yet — the
// question and the garden, but never the discussion. They can knock; the host
// decides. This is the whole point of the request model: the link only lets you
// ask, not walk in.
export function LockedSeed({ preview }: { preview: Preview }) {
  const [status, setStatus] = useState(preview.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestJoin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ status: Preview["status"] }>(
        `/api/seeds/${preview.id}/join-request`,
      );
      setStatus(r.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-md text-center">
      <div className="card p-6">
        <div className="mb-2 text-3xl">🔒</div>
        {preview.garden && (
          <p className="eyebrow mb-1">
            {preview.garden.emoji} {preview.garden.name}
          </p>
        )}
        <h1 className="serif-lg mb-2 break-words">{preview.title}</h1>
        <p className="mb-5 text-xs text-ink-soft">
          A private discussion · {preview.memberCount}{" "}
          {preview.memberCount === 1 ? "member" : "members"}
        </p>

        {status === "member" ? (
          <p className="text-sm text-accent">You&apos;re in — reload to open it. 🌱</p>
        ) : status === "pending" ? (
          <div className="rounded-xl border border-[rgba(255,179,0,0.35)] bg-[rgba(255,179,0,0.06)] p-4">
            <p className="text-sm font-medium text-ink">⏳ Waiting for the host to let you in</p>
            <p className="mt-1 text-xs text-ink-soft">
              You&apos;ll get a notification the moment they approve you.
            </p>
          </div>
        ) : status === "declined" ? (
          <p className="text-sm text-ink-soft">
            Your request wasn&apos;t accepted. Reach out to whoever shared this if you think that&apos;s
            a mistake.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-mid">
              This is a private seed. Ask the host to let you in — they&apos;ll approve or decline.
            </p>
            <button
              onClick={requestJoin}
              disabled={busy}
              className="btn-primary w-full disabled:opacity-60"
            >
              {busy ? "Sending…" : "Request to join 🌱"}
            </button>
          </>
        )}
        {error && <p className="mt-2 text-xs text-[#e57373]">{error}</p>}
      </div>
    </div>
  );
}
