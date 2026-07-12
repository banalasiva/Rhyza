"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

type Status = "none" | "pending_outgoing" | "pending_incoming" | "connected";

// Connect with someone. A mutual handshake: request → they accept. Once
// connected, you can add each other straight into private seeds. Distinct from
// the one-way Follow that sits beside it.
export function ConnectButton({
  userId,
  initialStatus,
}: {
  userId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function act(action: "request" | "accept" | "decline" | "remove") {
    if (busy) return;
    setBusy(true);
    try {
      const r = await apiPost<{ status: Status }>(`/api/users/${userId}/connect`, { action });
      setStatus(r.status);
    } catch {
      /* keep current state */
    } finally {
      setBusy(false);
    }
  }

  if (status === "connected") {
    return (
      <button
        onClick={() => {
          if (confirm("Remove them from your circle?")) void act("remove");
        }}
        disabled={busy}
        className="rounded-full border border-[rgba(76,175,80,0.4)] bg-[rgba(76,175,80,0.1)] px-4 py-1.5 text-xs font-medium text-accent transition hover:border-[rgba(76,175,80,0.6)] disabled:opacity-50"
        title="In your circle — tap to remove"
      >
        ✓ In your circle
      </button>
    );
  }

  if (status === "pending_incoming") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          onClick={() => act("accept")}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-bg transition disabled:opacity-50"
        >
          {busy ? "…" : "Accept 🤝"}
        </button>
        <button
          onClick={() => act("decline")}
          disabled={busy}
          aria-label="Decline"
          className="rounded-full border border-[rgba(255,255,255,0.14)] px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink disabled:opacity-50"
        >
          Decline
        </button>
      </span>
    );
  }

  if (status === "pending_outgoing") {
    return (
      <button
        onClick={() => act("remove")}
        disabled={busy}
        className="rounded-full border border-[rgba(255,255,255,0.14)] px-4 py-1.5 text-xs text-ink-soft transition hover:text-ink disabled:opacity-50"
        title="Request sent — tap to cancel"
      >
        {busy ? "…" : "Requested"}
      </button>
    );
  }

  return (
    <button
      onClick={() => act("request")}
      disabled={busy}
      className="rounded-full border border-[rgba(76,175,80,0.4)] px-4 py-1.5 text-xs font-medium text-accent transition hover:bg-[rgba(76,175,80,0.1)] disabled:opacity-50"
      title="Add to your circle so you can bring each other into private seeds"
    >
      {busy ? "…" : "🤝 Add to circle"}
    </button>
  );
}
