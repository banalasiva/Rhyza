"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

// "Join as a guest" — the no-Google way in, shown only on an invite (someone
// vouched). Type a name, and you're in the thread: read + reply. Creating a real
// account later (to ask AI or start your own seed) is one tap away.
export function GuestContinue({ token, redirectTo }: { token: string; redirectTo: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn("guest", {
        name: name.trim(),
        inviteToken: token,
        redirect: false,
      });
      if (res?.error) setError("Couldn't join as a guest. Try again, or sign in above.");
      else window.location.href = redirectTo;
    } catch {
      setError("Couldn't join as a guest.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <div className="mb-3 flex items-center gap-3 text-[11px] text-ink-soft">
          <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
          or, no sign-in
          <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-full border border-[rgba(76,175,80,0.45)] bg-[rgba(76,175,80,0.1)] px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[rgba(76,175,80,0.18)] active:scale-[0.99]"
        >
          👋 Join as a guest
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink-soft">
          Just a name — read &amp; reply right away.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={join} className="mt-3 space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="Your name"
        className="input w-full text-center"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="btn-ghost w-full disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join the conversation"}
      </button>
      <p className="text-center text-[11px] text-ink-soft">
        You can read &amp; reply as a guest. Create a free account anytime to ask Claude/ChatGPT or
        start your own.
      </p>
      {error && <p className="text-center text-xs text-[#e57373]">{error}</p>}
    </form>
  );
}
