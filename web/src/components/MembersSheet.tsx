"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Role = "owner" | "admin" | "member" | "contributor";
type Person = { id: string; name: string; image: string | null; role: Role; isYou: boolean };
type Roster = { people: Person[]; canManage: boolean; isPrivate: boolean; ownerId: string };

const ROLE_LABEL: Record<Role, string> = {
  owner: "👑 Owner",
  admin: "🛡 Admin",
  member: "Member",
  contributor: "Contributor",
};

// A bottom sheet listing everyone in a seed with their role. The owner (and
// admins) can promote participants to admin or remove them.
export function MembersSheet({ seedId, onClose }: { seedId: string; onClose: () => void }) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setRoster(await apiGet<Roster>(`/api/seeds/${seedId}/members`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load members");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId]);

  async function act(targetId: string, action: "promote" | "demote" | "remove") {
    if (action === "remove" && !confirm("Remove this person from the seed?")) return;
    setBusyId(targetId);
    setError(null);
    try {
      await apiPost(`/api/seeds/${seedId}/members`, { targetId, action });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Members"
        className="relative z-10 max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            👥 Members{roster ? ` · ${roster.people.length}` : ""}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft transition hover:text-ink">
            ✕
          </button>
        </div>

        {error && <p className="mb-2 text-xs text-[#e57373]">{error}</p>}
        {!roster && !error && <p className="text-sm text-ink-soft">Loading…</p>}

        {roster && !roster.isPrivate && roster.canManage && (
          <p className="mb-3 text-[11px] text-ink-soft">
            This is a public seed — anyone in the garden can join, so removing only
            affects roles, not access.
          </p>
        )}

        <ul className="space-y-1">
          {roster?.people.map((p) => {
            const manageable = roster.canManage && p.role !== "owner" && !p.isYou;
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                <Avatar name={p.name} image={p.image} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {p.name} {p.isYou && <span className="text-ink-soft">(you)</span>}
                  </p>
                  <p className="text-[11px] text-ink-soft">{ROLE_LABEL[p.role]}</p>
                </div>
                {manageable && (
                  <div className="flex shrink-0 items-center gap-1">
                    {p.role === "admin" ? (
                      <button
                        onClick={() => act(p.id, "demote")}
                        disabled={busyId === p.id}
                        className="rounded-md border border-[rgba(255,255,255,0.12)] px-2 py-1 text-[11px] text-ink-mid transition hover:text-ink disabled:opacity-50"
                      >
                        Remove admin
                      </button>
                    ) : (
                      <button
                        onClick={() => act(p.id, "promote")}
                        disabled={busyId === p.id}
                        className="rounded-md border border-[rgba(76,175,80,0.25)] px-2 py-1 text-[11px] text-accent transition hover:text-ink disabled:opacity-50"
                      >
                        Make admin
                      </button>
                    )}
                    <button
                      onClick={() => act(p.id, "remove")}
                      disabled={busyId === p.id}
                      aria-label={`Remove ${p.name}`}
                      className="rounded-md border border-[rgba(255,255,255,0.1)] px-2 py-1 text-[11px] text-ink-soft transition hover:text-[#e57373] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
