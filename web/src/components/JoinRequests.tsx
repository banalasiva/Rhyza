"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; image: string | null; requestedAt: string };

// Owner/steward panel: people knocking to join this private seed. Approve lets
// them in (they become a member and get notified); decline closes the request.
// Shown inside the seed details sheet, only to those who can manage the seed.
export function JoinRequests({ seedId }: { seedId: string }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await apiGet<{ people: Person[] }>(`/api/seeds/${seedId}/join-requests`);
      setPeople(r.people);
    } catch {
      setPeople([]);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId]);

  async function resolve(targetId: string, approve: boolean) {
    setBusyId(targetId);
    try {
      await apiPost(`/api/seeds/${seedId}/join-requests`, { targetId, approve });
      setPeople((prev) => (prev ? prev.filter((p) => p.id !== targetId) : prev));
    } catch {
      /* leave it; they can retry */
    } finally {
      setBusyId(null);
    }
  }

  // Nothing pending → render nothing (keeps the sheet clean).
  if (!people || people.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-[rgba(255,179,0,0.3)] bg-[rgba(255,179,0,0.05)] p-3">
      <p className="mb-2 text-sm font-medium text-ink">
        🙋 Requests to join · {people.length}
      </p>
      <ul className="space-y-1.5">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar name={p.name} image={p.image} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
            <button
              onClick={() => resolve(p.id, true)}
              disabled={busyId === p.id}
              className="btn-primary shrink-0 px-3 py-1 text-xs disabled:opacity-50"
            >
              {busyId === p.id ? "…" : "Approve"}
            </button>
            <button
              onClick={() => resolve(p.id, false)}
              disabled={busyId === p.id}
              className="shrink-0 rounded-md border border-[rgba(255,255,255,0.12)] px-2 py-1 text-xs text-ink-soft transition hover:text-[#e57373] disabled:opacity-50"
            >
              Decline
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
