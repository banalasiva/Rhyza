"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { apiGet, apiPost } from "@/lib/client";

type Passkey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  backedUp: boolean;
};

// Manage passkeys from settings: add one (Face ID / fingerprint), see the ones
// you have, remove any. Adding requires you to already be signed in (which you
// are, on this page) — the new passkey then becomes a one-tap way back in next
// time, on this device or any that syncs your passkeys (iCloud Keychain, Google
// Password Manager).
export function PasskeySetup() {
  const [supported, setSupported] = useState(false);
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  async function load() {
    try {
      const r = await apiGet<{ passkeys: Passkey[] }>("/api/passkeys");
      setKeys(r.passkeys);
    } catch {
      setKeys([]);
    }
  }

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
    load();
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    setJustAdded(false);
    try {
      const { options, challengeId } = await apiPost<{ options: unknown; challengeId: string }>(
        "/api/passkeys/register/options",
        {},
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await startRegistration(options as any);
      await apiPost("/api/passkeys/register/verify", { challengeId, response });
      setJustAdded(true);
      await load();
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "InvalidStateError") {
        setError("This device already has a passkey for ThinkThru.");
      } else if (name !== "NotAllowedError" && name !== "AbortError") {
        setError("Couldn't create a passkey on this device.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this passkey? You can always add a new one.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/passkeys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        // Surface the server's reason (e.g. the last-passkey lockout guard).
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message || "Couldn't remove that passkey.");
        return;
      }
      await load();
    } catch {
      setError("Couldn't remove that passkey.");
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-ink-soft">
        This device doesn&apos;t support passkeys. Try your phone (Face ID / fingerprint).
      </p>
    );
  }

  return (
    <div>
      <button onClick={add} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
        {busy ? "Follow the prompt…" : "🔑 Add a passkey"}
      </button>
      {justAdded && <p className="mt-1.5 text-xs text-accent">✓ Passkey added — you can sign in with it next time.</p>}
      {error && <p className="mt-1.5 text-xs text-[#e57373]">{error}</p>}

      {keys && keys.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">🔑 {k.name}</p>
                <p className="text-[11px] text-ink-soft">
                  Added {new Date(k.createdAt).toLocaleDateString()}
                  {k.backedUp ? " · synced" : ""}
                </p>
              </div>
              <button
                onClick={() => remove(k.id)}
                className="shrink-0 text-[11px] text-ink-soft transition hover:text-[#e57373]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
