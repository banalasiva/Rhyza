"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiGet } from "@/lib/client";
import { toWhatsAppNumber } from "@/lib/phone";
import { inviteMessage } from "@/lib/invite";
import { Avatar } from "@/components/Avatar";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { track } from "@/lib/analytics";

type NetworkPerson = { id: string; name: string; email: string };
type Addable = { id: string; name: string; email: string; image: string | null };

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
  // "Add someone already on ThinkThru" — search the org roster and drop them in
  // directly (no invite link).
  const router = useRouter();
  const [q, setQ] = useState("");
  const [addable, setAddable] = useState<Addable[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // Contacts flow: people picked from the phone's own contact sheet, plus the
  // one shared invite link we open WhatsApp with — no SMS gateway, no Firebase.
  const [picked, setPicked] = useState<{ name: string; tels: string[]; email?: string }[]>([]);
  const [sentTel, setSentTel] = useState<Set<string>>(new Set());
  const [linkBusy, setLinkBusy] = useState(false);

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

  // Create (once) the shared invite link every contact will receive. Reusable,
  // so one link serves everyone she picks — a single round-trip, not one per
  // person. Returns the link, or null on failure.
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

  // Open the phone's native contact sheet and let her pick as many people as she
  // likes (multiple: true). We read only name/tel/email for the ones she taps —
  // never the whole book — so it's privacy-safe and needs no special permission.
  // Then we create the shared link so every "WhatsApp" tap is instant.
  async function pickContacts() {
    try {
      const nav = navigator as {
        contacts?: { select?: (p: string[], o: { multiple: boolean }) => Promise<unknown[]> };
      };
      const raw = (await nav.contacts?.select?.(["name", "tel", "email"], { multiple: true })) as
        | { name?: string[]; tel?: string[]; email?: string[] }[]
        | undefined;
      if (!raw?.length) return;
      const mapped = raw.map((c) => ({
        name: c.name?.[0] || c.tel?.[0] || c.email?.[0] || "Contact",
        // Keep EVERY number the contact has (a sister saved with 4 numbers
        // shouldn't force a guess) — de-duped, so she can tap the right one.
        tels: [...new Set(c.tel ?? [])],
        email: c.email?.[0],
      }));
      setPicked(mapped);
      setSentTel(new Set());
      track("invite_contacts_picked", { count: mapped.length, scope: "seed" });
      await ensureLink();
    } catch {
      /* user cancelled the picker */
    }
  }

  // Open WhatsApp to one picked contact with the warm invite prefilled. Rides
  // the inviter's own WhatsApp (wa.me) — no SMS cost, works with her real number
  // so it lands as a message from someone they know, not an anonymous gateway.
  async function whatsappTo(tel: string) {
    const link = (await ensureLink()) ?? result?.link;
    if (!link) return;
    const digits = toWhatsAppNumber(tel);
    const msg = inviteMessage({ place: gardenName, link });
    setSentTel((s) => new Set(s).add(tel));
    track("invite_shared", { via: "whatsapp", scope: "seed" });
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function message() {
    return inviteMessage({ place: gardenName, link: result!.link, email: email || undefined });
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
  // the warm invite prefilled. Works on every device (incl. iOS) and rides the
  // inviter's own WhatsApp — no SMS gateway / Twilio.
  function whatsapp() {
    if (!result) return;
    track("invite_shared", { via: "whatsapp", scope: "seed" });
    window.location.href = `https://wa.me/?text=${encodeURIComponent(message())}`;
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
    await navigator.clipboard.writeText(message());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inner = (
    <>
      {/* 📇 Invite from your contacts — the headline path. Pick people from the
          phone's own contact sheet (no typing emails); each opens WhatsApp with
          a warm invite from the inviter's real number. Android only; iOS falls
          back to the WhatsApp chooser + link below. */}
      {canPick && (
        <div className="mb-4">
          <button
            type="button"
            onClick={pickContacts}
            disabled={linkBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-3 text-sm font-semibold text-[#04310f] transition active:scale-95 disabled:opacity-60"
          >
            📇 Invite from your contacts
          </button>
          <p className="mt-1.5 text-[11px] text-ink-soft">
            Pick people from your phone — we’ll open WhatsApp with a warm invite. No emails to type.
          </p>
          {picked.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {picked.map((c, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5"
                >
                  {c.tels.length <= 1 ? (
                    // One number (or none): a single tap sends it off.
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{c.name}</p>
                        <p className="truncate text-[11px] text-ink-soft">
                          {c.tels[0] || c.email || "No number saved"}
                        </p>
                      </div>
                      {c.tels[0] ? (
                        <button
                          onClick={() => whatsappTo(c.tels[0])}
                          disabled={linkBusy}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-[#04310f] transition active:scale-95 disabled:opacity-60"
                        >
                          <WhatsAppIcon />
                          {sentTel.has(c.tels[0]) ? "Sent ✓" : "WhatsApp"}
                        </button>
                      ) : c.email ? (
                        <button onClick={() => setEmail(c.email!)} className="btn-ghost shrink-0 px-3 py-1 text-xs">
                          Use email ↓
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    // Several numbers saved (e.g. a sister with 4): show each as
                    // its own tap so she picks the right one — no guessing.
                    <div>
                      <p className="truncate text-sm text-ink">{c.name}</p>
                      <p className="mb-1.5 text-[11px] text-ink-soft">Which number?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.tels.map((t) => (
                          <button
                            key={t}
                            onClick={() => whatsappTo(t)}
                            disabled={linkBusy}
                            className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-2.5 py-1 text-xs font-semibold text-[#04310f] transition active:scale-95 disabled:opacity-60"
                          >
                            <WhatsAppIcon />
                            {sentTel.has(t) ? "Sent ✓" : t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {canPick && <div className="mb-3 border-t border-[rgba(255,255,255,0.08)]" />}

      {/* Search anyone on ThinkThru → add them straight in, no invite, no accept. */}
      <div className="mb-4">
        <p className="mb-1 text-sm font-medium text-ink">👋 Add anyone on ThinkThru</p>
        <p className="mb-2 text-xs text-ink-soft">
          Search anyone by name or email and add them straight in — they can read and reply right
          away. No invite, no waiting.
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

      <p className="mb-1 text-sm font-medium text-ink">🔗 Invite someone new</p>
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
              ? "✉️ A warm invite is on its way to their inbox. Send it directly too:"
              : "🔗 Invite ready — every option sends a warm message, not just a link:"}
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
