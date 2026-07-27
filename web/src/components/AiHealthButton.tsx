"use client";

import { useState } from "react";
import { apiGet } from "@/lib/client";

type Health = { configured: boolean; model: string; ok: boolean; detail: string };

// Owner-only: ping Claude + ChatGPT with a tiny real completion and show the
// exact provider status. This is the fast way to tell WHY an AI reply failed
// (bad key, wrong/retired model, credit balance too low, rate limit, transient)
// instead of guessing from a generic "couldn't reply".
export function AiHealthButton() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ claude: Health; chatgpt: Health } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      setRes(await apiGet<{ claude: Health; chatgpt: Health }>("/api/admin/ai-health"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't run the check — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <p className="mb-1 text-sm text-ink">🩺 AI health check</p>
      <p className="mb-3 text-xs text-ink-soft">
        Pings Claude and ChatGPT with a tiny real request and shows the exact provider status — so a
        failed reply says WHY (bad key, retired model, out of credit, rate limit) instead of a
        generic error. Spends a token or two.
      </p>
      <button onClick={run} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
        {busy ? "Pinging…" : "Run health check"}
      </button>
      {err && <p className="mt-2 text-xs text-[#e57373]">{err}</p>}
      {res && (
        <div className="mt-3 space-y-2">
          {(["claude", "chatgpt"] as const).map((k) => {
            const h = res[k];
            return (
              <div key={k} className="rounded-lg border border-[rgba(255,255,255,0.08)] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{k === "claude" ? "Claude" : "ChatGPT"}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={
                      h.ok
                        ? { color: "#66BB6A", background: "rgba(76,175,80,0.12)" }
                        : { color: "#e57373", background: "rgba(229,115,115,0.12)" }
                    }
                  >
                    {h.ok ? "OK ✓" : h.configured ? "Failing" : "Not configured"}
                  </span>
                </div>
                <p className="mt-1 break-words text-[11px] text-ink-soft">
                  <span className="text-ink-mid">model:</span> {h.model}
                </p>
                {!h.ok && (
                  <p className="mt-1 break-words text-[11px] text-ink-mid">{h.detail}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
