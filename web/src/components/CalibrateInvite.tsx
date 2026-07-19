"use client";

import { useRef, useState } from "react";

// "Ask how it landed" — mint the bloom's calibration link, choose who can open
// it (Google-Docs style: anyone with the link, or only specific emails), and
// hand it to the people the decision affected.
type Settings = { token: string; access: "anyone" | "restricted" | "off"; allowedEmails: string[] };

export function CalibrateInvite({ bloomId }: { bloomId: string }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const savingRef = useRef(false);

  async function openPanel() {
    setOpen(true);
    if (s) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blooms/${bloomId}/share`, { method: "POST" });
      if (res.ok) setS((await res.json()) as Settings);
    } catch {
      setMsg("Couldn't load the link.");
    } finally {
      setBusy(false);
    }
  }

  async function save(next: { access: Settings["access"]; allowedEmails: string[] }) {
    setS((prev) => (prev ? { ...prev, ...next } : prev));
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const res = await fetch(`/api/blooms/${bloomId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) setS((await res.json()) as Settings);
    } catch {
      /* keep optimistic */
    } finally {
      savingRef.current = false;
    }
  }

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!e.includes("@") || !s) return;
    if (s.allowedEmails.includes(e)) {
      setEmailDraft("");
      return;
    }
    save({ access: "restricted", allowedEmails: [...s.allowedEmails, e] });
    setEmailDraft("");
  }

  async function shareLink() {
    if (!s) return;
    const url = `${window.location.origin}/calibrate/${s.token}`;
    const text = "You were part of this — how did it actually land for you? 🌱";
    if (navigator.share) {
      try {
        await navigator.share({ title: "How did it land?", text, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Link copied — send it to whoever it affected.");
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg(url);
    }
  }

  return (
    <div className="no-print relative">
      <button onClick={openPanel} className="btn-ghost px-4 py-1.5 text-xs">
        🔗 Ask how it landed
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-[rgba(76,175,80,0.3)] bg-[#0B120B] p-4 text-left shadow-xl">
            {busy && !s ? (
              <p className="text-xs text-ink-soft">Loading…</p>
            ) : s ? (
              <>
                <p className="mb-2 text-xs font-medium text-ink">Who can open this?</p>
                <div className="mb-3 space-y-1">
                  {(
                    [
                      { key: "anyone", label: "Anyone with the link" },
                      { key: "restricted", label: "Only people I add" },
                      { key: "off", label: "Off — no one can open" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => save({ access: opt.key, allowedEmails: s.allowedEmails })}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                        s.access === opt.key ? "bg-[rgba(76,175,80,0.12)] text-accent" : "text-ink-mid hover:text-ink"
                      }`}
                    >
                      <span aria-hidden>{s.access === opt.key ? "●" : "○"}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {s.access === "restricted" && (
                  <div className="mb-3">
                    <div className="flex gap-1.5">
                      <input
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                        placeholder="add email…"
                        className="input h-8 flex-1 text-xs"
                        type="email"
                      />
                      <button onClick={addEmail} className="btn-ghost px-2.5 text-xs">
                        Add
                      </button>
                    </div>
                    {s.allowedEmails.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.allowedEmails.map((e) => (
                          <span
                            key={e}
                            className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[11px] text-ink-mid"
                          >
                            {e}
                            <button
                              onClick={() =>
                                save({
                                  access: "restricted",
                                  allowedEmails: s.allowedEmails.filter((x) => x !== e),
                                })
                              }
                              aria-label={`Remove ${e}`}
                              className="text-ink-soft hover:text-[#e57373]"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {s.allowedEmails.length === 0 && (
                      <p className="mt-1.5 text-[10px] text-ink-soft">
                        Add at least one email, or nobody can open it.
                      </p>
                    )}
                  </div>
                )}

                {s.access === "off" ? (
                  <p className="rounded-lg bg-[rgba(255,255,255,0.04)] px-3 py-2 text-center text-[11px] text-ink-soft">
                    Sharing is off — the link won&apos;t open for anyone. Switch it back any time.
                  </p>
                ) : (
                  <button onClick={shareLink} className="btn-primary w-full text-xs">
                    🔗 Copy / share link
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-[#e57373]">{msg ?? "Couldn't load."}</p>
            )}
          </div>
        </>
      )}
      {msg && !open && <p className="mt-1 text-right text-[11px] text-ink-soft">{msg}</p>}
    </div>
  );
}
