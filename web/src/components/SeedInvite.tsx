"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiGet } from "@/lib/client";
import { inviteMessage } from "@/lib/invite";
import { Avatar } from "@/components/Avatar";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { track } from "@/lib/analytics";

type Addable = { id: string; name: string; email: string; image: string | null };

// "Invite to this seed" — two clean paths, nothing else in the way:
//   1. Add someone already on ThinkThru → straight in, no invite, no accept.
//   2. Invite someone new with a link → WhatsApp / share / copy (a warm message,
//      not a bare link). Sharing the URL alone never grants access; the invite
//      is what does.
// Email invites and workspace-directory auto-fill are coming back later; they're
// intentionally left out here so the two everyday paths stay obvious.
export function SeedInvite({
  seedId,
  gardenName,
  seedTitle,
  isPrivate,
  inline = false,
}: {
  seedId: string;
  gardenName: string;
  seedTitle?: string; // the seed's question — carried into the warm invite as the hook
  isPrivate: boolean;
  inline?: boolean; // render the form directly (e.g. inside the details sheet)
}) {
  const [open, setOpen] = useState(inline);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const router = useRouter();
  // "Add someone already on ThinkThru" — search the roster and drop them in.
  const [q, setQ] = useState("");
  const [addable, setAddable] = useState<Addable[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // The link is the amazing part — have it ready the moment the invite opens, so
  // sharing is one tap. Reuses an existing pending link (idempotent server-side).
  useEffect(() => {
    if (open && !result) void ensureLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search of people already on ThinkThru (in this seed's org).
  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const t = setTimeout(() => {
      apiGet<{ people: Addable[] }>(`/api/seeds/${seedId}/addable?q=${encodeURIComponent(q)}`)
        .then((r) => setAddable(r.people ?? []))
        .catch(() => setAddable([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, seedId, open]);

  async function addPerson(id: string) {
    setAddingId(id);
    setError(null);
    try {
      await apiPost(`/api/seeds/${seedId}/members`, { targetId: id, action: "add" });
      setAddedIds((s) => new Set(s).add(id));
      router.refresh(); // so they're immediately taggable
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add them");
    } finally {
      setAddingId(null);
    }
  }

  // Create (once) the shared invite link. Reusable, so one link serves everyone.
  async function ensureLink(): Promise<string | null> {
    if (result?.link) return result.link;
    setLinkBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ link: string; emailed: boolean }>(
        `/api/seeds/${seedId}/invites`,
        {},
      );
      setResult(res);
      return res.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite");
      return null;
    } finally {
      setLinkBusy(false);
    }
  }

  function message() {
    return inviteMessage({ place: gardenName, topic: seedTitle, link: result!.link });
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({ title: "Join me on ThinkThru 🌱", text: message() });
    } catch {
      /* dismissed */
    }
  }

  // Direct WhatsApp — no number, so WhatsApp opens its own contact chooser with
  // the warm invite prefilled. Works on every device and rides the inviter's own
  // WhatsApp (wa.me) — no SMS gateway.
  function whatsapp() {
    if (!result) return;
    track("invite_shared", { via: "whatsapp", scope: "seed" });
    window.location.href = `https://wa.me/?text=${encodeURIComponent(message())}`;
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(message());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inner = (
    <>
      {/* 1 · Add someone already on ThinkThru → straight in, no invite, no accept. */}
      <div className="mb-4">
        <p className="mb-1 text-sm font-medium text-ink">👋 Add someone on ThinkThru</p>
        <p className="mb-2 text-xs text-ink-soft">
          Search by name or email and add them straight in — they can read and reply right away.
        </p>
        <input
          className="input w-full"
          placeholder="Search anyone by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {addable.length > 0 && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {addable.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={p.name} image={p.image} size={22} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{p.name}</p>
                    <p className="truncate text-[11px] text-ink-soft">{p.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => addPerson(p.id)}
                  disabled={addingId === p.id || addedIds.has(p.id)}
                  className="btn-primary shrink-0 px-3 py-1 text-xs disabled:opacity-60"
                >
                  {addedIds.has(p.id) ? "✓ Added" : addingId === p.id ? "Adding…" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!q && addable.length >= 6 && (
          <p className="mt-2 text-[11px] text-ink-soft">
            A few from your circle — type a name to search everyone on ThinkThru.
          </p>
        )}
        {q && !searching && addable.length === 0 && (
          <p className="mt-2 text-xs text-ink-soft">
            No one by that name yet. Not on ThinkThru? Invite them with a link below.
          </p>
        )}
      </div>

      <div className="mb-3 border-t border-[rgba(255,255,255,0.08)]" />

      {/* 2 · Invite someone new with a link — WhatsApp / share / copy. */}
      <p className="mb-1 text-sm font-medium text-ink">🔗 Invite with a link</p>
      <p className="mb-3 text-xs text-ink-soft">
        They&apos;ll join <strong className="text-ink-mid">{gardenName}</strong>
        {isPrivate ? " and this private discussion" : ""} and can open this seed. Sharing just the
        link won&apos;t give access — they need this invite.
      </p>

      {error && !result && <p className="mb-2 text-sm text-[#e57373]">{error}</p>}
      <div className="rounded-xl border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.4)] p-3">
        {result ? (
          <>
            <p className="mb-2 text-xs text-ink-mid">
              🔗 Invite ready — it sends a warm message, not just a link:
            </p>
            <button
              onClick={whatsapp}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-[#04310f] transition active:scale-95"
            >
              <WhatsAppIcon />
              Invite on WhatsApp
            </button>
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
          </>
        ) : (
          <p className="text-xs text-ink-soft">
            {linkBusy ? "Preparing your invite link…" : "Getting your invite link ready…"}
          </p>
        )}
      </div>
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
