"use client";

import { useEffect, useState } from "react";
import { apiPost, apiGet } from "@/lib/client";

type NetworkPerson = { id: string; name: string; email: string };

// "Invite to this seed" affordance. Posts a seed-scoped invite — accepting joins
// the org, the garden, and (for private seeds) the seed itself. Sharing the URL
// alone never grants access; the invite is what does.
export function SeedInvite({
  seedId,
  gardenName,
  isPrivate,
  inline = false,
}: {
  seedId: string;
  gardenName: string;
  isPrivate: boolean;
  inline?: boolean; // render the form directly (e.g. inside the details sheet)
}) {
  const [open, setOpen] = useState(inline);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
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
      /* user cancelled */
    }
  }

  // Phone-only contact → create a link invite and open WhatsApp to that number.
  async function inviteViaWhatsApp(tel: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ link: string; emailed: boolean }>(
        `/api/seeds/${seedId}/invites`,
        {},
      );
      setResult(res);
      const digits = tel.replace(/[^\d]/g, "");
      const msg = `Come think this through with me on ThinkThru 🌱\n${res.link}`;
      window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({
        title: "Join me on ThinkThru 🌱",
        text: "I'd love your take — come think this through with me:",
        url: result.link,
      });
    } catch {
      /* dismissed */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiPost<{ link: string; emailed: boolean }>(
        `/api/seeds/${seedId}/invites`,
        email ? { email } : {},
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
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

  const inner = (
    <>
      <p className="mb-1 text-sm font-medium text-ink">🔗 Invite someone</p>
      <p className="mb-3 text-xs text-ink-soft">
        They&apos;ll join <strong className="text-ink-mid">{gardenName}</strong>
        {isPrivate ? " and this private discussion" : ""} and can open this seed.{" "}
        Sharing just the link won&apos;t give access — they need this invite.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2">
          <input
            className="input flex-1"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            list="invite-network-seed"
            placeholder="teammate@email.com (or leave blank for a link)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {people.length > 0 && (
            <datalist id="invite-network-seed">
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
          {busy ? "Creating…" : email ? "Send" : "Create link"}
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
        </div>
      )}
    </>
  );

  // Inside the details sheet: render the form directly.
  if (inline) return <div className="text-left">{inner}</div>;

  return (
    <div className="inline-block">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-xs">
        {open ? "✕ Close" : "🔗 Invite"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(92vw,26rem)]">
          <div className="card p-4 text-left">{inner}</div>
        </div>
      )}
    </div>
  );
}
