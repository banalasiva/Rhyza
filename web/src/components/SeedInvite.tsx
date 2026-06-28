"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

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
        <input
          className="input flex-1"
          type="email"
          placeholder="teammate@email.com (or leave blank for a link)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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
