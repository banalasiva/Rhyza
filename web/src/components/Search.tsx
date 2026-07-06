"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Results = {
  query: string;
  seeds: { id: string; title: string; stageEmoji: string; gardenName: string; snippet: string | null }[];
  messages: { id: string; seedId: string; seedTitle: string; author: string; snippet: string }[];
  gardens: { id: string; name: string; emoji: string }[];
  people: { id: string; name: string | null; image: string | null }[];
  total: number;
};

export function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await apiGet<Results>(`/api/search?q=${encodeURIComponent(query)}`);
        if (mine === seq.current) {
          setResults(r);
          setLoading(false);
        }
      } catch {
        if (mine === seq.current) {
          setResults(null);
          setLoading(false);
        }
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const showEmpty = results && results.total === 0 && !loading;

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">🔍</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search seeds, messages, gardens, people…"
          className="input w-full py-3 pl-11 pr-10 text-[15px]"
          autoComplete="off"
          aria-label="Search ThinkThru"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft transition hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {q.trim().length > 0 && q.trim().length < 2 && (
        <p className="mt-4 text-center text-sm text-ink-soft">Keep typing…</p>
      )}
      {loading && <p className="mt-6 text-center text-sm text-ink-soft">Searching…</p>}
      {showEmpty && (
        <p className="mt-6 text-center text-sm text-ink-soft">
          Nothing found for “{results!.query}”.
        </p>
      )}

      {results && results.total > 0 && (
        <div className="mt-5 space-y-6">
          {results.seeds.length > 0 && (
            <Group title="🌱 Seeds">
              {results.seeds.map((s) => (
                <Row key={s.id} href={`/seeds/${s.id}`}>
                  <p className="flex items-center gap-2 text-sm text-ink">
                    <span>{s.stageEmoji}</span>
                    <span className="font-serif">{s.title}</span>
                  </p>
                  {s.snippet && <p className="mt-0.5 line-clamp-1 text-xs text-ink-mid">{s.snippet}</p>}
                  {s.gardenName && <p className="mt-0.5 text-[11px] text-ink-soft">in {s.gardenName}</p>}
                </Row>
              ))}
            </Group>
          )}

          {results.messages.length > 0 && (
            <Group title="💬 Messages">
              {results.messages.map((m) => (
                <Row key={m.id} href={`/seeds/${m.seedId}#c-${m.id}`}>
                  <p className="line-clamp-2 text-sm text-ink-mid">{m.snippet}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    {m.author} · in {m.seedTitle}
                  </p>
                </Row>
              ))}
            </Group>
          )}

          {results.gardens.length > 0 && (
            <Group title="🌿 Gardens">
              {results.gardens.map((g) => (
                <Row key={g.id} href={`/gardens/${g.id}`}>
                  <p className="flex items-center gap-2 text-sm text-ink">
                    <span>{g.emoji}</span>
                    <span className="font-serif">{g.name}</span>
                  </p>
                </Row>
              ))}
            </Group>
          )}

          {results.people.length > 0 && (
            <Group title="👤 People">
              {results.people.map((p) => (
                <Row key={p.id} href={`/u/${p.id}`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={p.name} image={p.image} size={28} />
                    <span className="text-sm text-ink">{p.name || "Someone"}</span>
                  </span>
                </Row>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="card block p-3 transition hover:border-accent">
        {children}
      </Link>
    </li>
  );
}
