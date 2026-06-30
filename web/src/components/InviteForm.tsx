"use client";

import { useEffect, useState } from "react";
import { apiPost, apiGet } from "@/lib/client";

type NetworkPerson = { id: string; name: string; email: string };

export function InviteForm({ gardenId }: { gardenId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  // Feature-detect the browser capabilities (client-only).
  const [canShare, setCanShare] = useState(false);
  const [canPick, setCanPick] = useState(false);
  const [people, setPeople] = useState<NetworkPerson[]>([]);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanPick(
      typeof navigator !== "undefined" &&
        "contacts" in navigator &&
        typeof (navigator as { contacts?: { select?: unknown } }).contacts?.select === "function",
    );
    apiGet<{ people: NetworkPerson[] }>("/api/me/network")
      .then((r) => setPeople(r.people ?? []))
      .catch(() => {});
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

  // Pick a contact from the phone's address book (Chrome/Android, TWA). We ask
  // for email AND phone so phone-only contacts (e.g. parents on WhatsApp) aren't
  // missing. Email → fills the field; phone-only → create a link and hand it to
  // them over WhatsApp.
  async function pickContact() {
    try {
      const nav = navigator as {
        contacts?: { select?: (p: string[], o: { multiple: boolean }) => Promise<unknown[]> };
      };
      const picked = (await nav.contacts?.select?.(["name", "email", "tel"], { multiple: false })) as
        | { email?: string[]; tel?: string[] }[]
        | undefined;
      const c = picked?.[0];
      const foundEmail = c?.email?.[0];
      const foundTel = c?.tel?.[0];
      if (foundEmail) {
        setEmail(foundEmail);
        return;
      }
      if (foundTel) await inviteViaWhatsApp(foundTel);
    } catch {
      /* user cancelled the picker */
    }
  }

  // Create a link invite and open WhatsApp to a phone number with it preloaded.
  async function inviteViaWhatsApp(tel: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ link: string; emailed: boolean }>(
        `/api/gardens/${gardenId}/invites`,
        {},
      );
      setResult(res);
      const digits = tel.replace(/[^\d]/g, "");
      const msg = `Come think this through with me on ThinkThru 🌱\n${res.link}`;
      // location.href (not window.open) so it isn't popup-blocked after the await;
      // on mobile this opens the WhatsApp app via the wa.me deep link.
      window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite");
    } finally {
      setBusy(false);
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
            list="invite-network-garden"
            placeholder="teammate@email.com (or leave blank for a link)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {people.length > 0 && (
            <datalist id="invite-network-garden">
              {people.map((p) => (
                <option key={p.id} value={p.email}>
                  {p.name}
                </option>
              ))}
            </datalist>
          )}
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
