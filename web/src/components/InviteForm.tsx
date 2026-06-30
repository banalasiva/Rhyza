"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/client";

export function InviteForm({ gardenId }: { gardenId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  // Feature-detect the browser capabilities (client-only).
  const [canShare, setCanShare] = useState(false);
  const [canPick, setCanPick] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanPick(
      typeof navigator !== "undefined" &&
        "contacts" in navigator &&
        typeof (navigator as { contacts?: { select?: unknown } }).contacts?.select === "function",
    );
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiPost<{ link: string; emailed: boolean }>(
        `/api/gardens/${gardenId}/invites`,
        email ? { email } : {},
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setBusy(false);
    }
  }

  // Pick an email straight from the phone's address book (Chrome/Android, TWA).
  async function pickContact() {
    try {
      const nav = navigator as {
        contacts?: { select?: (p: string[], o: { multiple: boolean }) => Promise<unknown[]> };
      };
      const picked = (await nav.contacts?.select?.(["email"], { multiple: false })) as
        | { email?: string[] }[]
        | undefined;
      const found = picked?.[0]?.email?.[0];
      if (found) setEmail(found);
    } catch {
      /* user cancelled the picker */
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // One-tap native share sheet (WhatsApp, SMS, email…) with the link preloaded.
  async function share() {
    if (!result) return;
    try {
      await navigator.share({
        title: "Join me on ThinkThru 🌱",
        text: "I'd love your take — come think this through with me:",
        url: result.link,
      });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2">
          <input
            className="input flex-1"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="teammate@email.com (or leave blank for a link)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {canPick && (
            <button
              type="button"
              onClick={pickContact}
              title="Pick from your contacts"
              aria-label="Pick an email from your contacts"
              className="btn-ghost shrink-0 px-2.5 py-2 text-sm"
            >
              📇
            </button>
          )}
        </div>
        <button type="submit" className="btn-primary shrink-0" disabled={busy}>
          {busy ? "Creating…" : email ? "Send invite" : "Create link"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-[#e57373]">{error}</p>}

      {result && (
        <div className="mt-3 rounded-xl border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.4)] p-3">
          <p className="mb-2 text-xs text-ink-mid">
            {result.emailed
              ? "✉️ Invite emailed. You can also share this link:"
              : "🔗 Invite link created — share it:"}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs text-ink-soft">{result.link}</code>
            {canShare && (
              <button onClick={share} className="btn-primary shrink-0 px-3 py-1 text-xs">
                Share
              </button>
            )}
            <button onClick={copy} className="btn-ghost shrink-0 px-3 py-1 text-xs">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          {!result.emailed && email && (
            <p className="mt-2 text-xs text-ink-soft">
              (Email isn&apos;t configured, so nothing was sent — share the link manually.)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
