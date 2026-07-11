"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; image: string | null };

// People waiting for you to accept a connection — surfaced on the You page so
// requests don't get lost. Accept puts them in your circle (addable to your
// private seeds); decline clears it.
export function ConnectionRequests() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ people: Person[] }>("/api/me/connection-requests")
      .then((r) => setPeople(r.people))
      .catch(() => setPeople([]));
  }, []);

  async function respond(id: string, action: "accept" | "decline") {
    setBusyId(id);
    try {
      await apiPost(`/api/users/${id}/connect`, { action });
      setPeople((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch {
      /* leave it */
    } finally {
      setBusyId(null);
    }
  }

  if (!people || people.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.06)] p-4">
      <p className="mb-2 text-sm font-medium text-ink">🤝 Connection requests · {people.length}</p>
      <ul className="space-y-1.5">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Link href={`/u/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar name={p.name} image={p.image} size={30} />
              <span className="min-w-0 truncate text-sm text-ink">{p.name}</span>
            </Link>
            <button
              onClick={() => respond(p.id, "accept")}
              disabled={busyId === p.id}
              className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-bg transition disabled:opacity-50"
            >
              {busyId === p.id ? "…" : "Accept"}
            </button>
            <button
              onClick={() => respond(p.id, "decline")}
              disabled={busyId === p.id}
              className="shrink-0 rounded-full border border-[rgba(255,255,255,0.14)] px-2.5 py-1 text-xs text-ink-soft transition hover:text-ink disabled:opacity-50"
            >
              Decline
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
