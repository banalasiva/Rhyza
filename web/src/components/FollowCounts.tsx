"use client";

import { useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; image: string | null };
type Kind = "followers" | "following";

// The profile's follower / following counts — now tappable. Opens a sheet that
// lists the actual people, each a link to their profile, so you can wander from
// one person's circle into another's.
export function FollowCounts({
  userId,
  followers,
  following,
}: {
  userId: string;
  followers: number;
  following: number;
}) {
  const [open, setOpen] = useState<Kind | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function show(kind: Kind, count: number) {
    if (count === 0) return;
    setOpen(kind);
    setPeople(null);
    setError(null);
    try {
      const r = await apiGet<{ people: Person[] }>(`/api/users/${userId}/follows?kind=${kind}`);
      setPeople(r.people);
    } catch {
      setError("Couldn't load the list");
    }
  }

  return (
    <>
      <p className="mt-1 text-xs text-ink-soft">
        <button
          onClick={() => show("followers", followers)}
          className={followers > 0 ? "transition hover:text-ink" : "cursor-default"}
        >
          <span className="font-semibold text-ink">{followers}</span>{" "}
          {followers === 1 ? "follower" : "followers"}
        </button>
        <span className="mx-1.5">·</span>
        <button
          onClick={() => show("following", following)}
          className={following > 0 ? "transition hover:text-ink" : "cursor-default"}
        >
          <span className="font-semibold text-ink">{following}</span> following
        </button>
      </p>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(null)}
          />
          <div
            role="dialog"
            aria-label={open === "followers" ? "Followers" : "Following"}
            className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-[rgba(76,175,80,0.2)] bg-[#0B120B] p-4 pb-[calc(1rem+4.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink capitalize">{open}</h2>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {error && <p className="text-xs text-[#e57373]">{error}</p>}
            {!people && !error && <p className="text-sm text-ink-soft">Loading…</p>}
            {people && people.length === 0 && (
              <p className="text-sm text-ink-soft">No one yet.</p>
            )}
            <ul className="space-y-1">
              {people?.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/u/${p.id}`}
                    onClick={() => setOpen(null)}
                    className="flex items-center gap-3 rounded-lg px-1 py-1.5 transition hover:bg-white/5"
                  >
                    <Avatar name={p.name} image={p.image} size={34} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                    <span className="shrink-0 text-xs text-ink-soft">View →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
