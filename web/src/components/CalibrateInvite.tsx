"use client";

import { useState } from "react";

// "Ask how it landed" — mint the bloom's calibration link and hand it to the
// people the decision affected (WhatsApp, wherever). Their honest read comes
// back next to your own, so you calibrate your judgment against reality.
export function CalibrateInvite({ bloomId }: { bloomId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/blooms/${bloomId}/share`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { token } = (await res.json()) as { token: string };
      const url = `${window.location.origin}/calibrate/${token}`;
      const text = "You were part of this — how did it actually land for you? 🌱";
      if (navigator.share) {
        try {
          await navigator.share({ title: "How did it land?", text, url });
          setMsg(null);
        } catch {
          /* user dismissed the share sheet */
        }
      } else {
        await navigator.clipboard.writeText(url);
        setMsg("Link copied — send it to whoever it affected.");
        setTimeout(() => setMsg(null), 4000);
      }
    } catch {
      setMsg("Couldn't create the link — try again.");
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print">
      <button onClick={share} disabled={busy} className="btn-ghost px-4 py-1.5 text-xs">
        {busy ? "…" : "🔗 Ask how it landed"}
      </button>
      {msg && <p className="mt-1 text-right text-[11px] text-ink-soft">{msg}</p>}
    </div>
  );
}
