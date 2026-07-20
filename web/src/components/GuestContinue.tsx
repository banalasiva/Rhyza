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
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full text-center text-xs text-ink-soft transition hover:text-ink"
      >
        Prefer not to sign in? <span className="text-ink">Join as a guest →</span>
      </button>
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
