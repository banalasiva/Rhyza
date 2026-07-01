"use client";

import { useEffect, useState } from "react";

type Quote = { id: string; text: string; author: string | null; active: boolean; createdAt: string };

// Owner's curation screen for the daily "good morning" library. Read through
// them, add your own, retire ones that don't fit, toggle without deleting.
export function DailyMessagesAdmin() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/daily");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't load");
      setQuotes(data.quotes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load");
      setQuotes([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function api(method: string, body?: unknown, qs = "") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/daily${qs}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!text.trim()) return;
    if (await api("POST", { text, author })) {
      setText("");
      setAuthor("");
    }
  }
  async function saveEdit(id: string) {
    if (await api("PATCH", { id, text: editText, author: editAuthor })) setEditingId(null);
  }

  if (quotes === null) return <p className="text-sm text-ink-soft">Loading the library…</p>;

  const total = quotes.length;
  const activeCount = quotes.filter((q) => q.active).length;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-[rgba(229,115,115,0.1)] px-3 py-2 text-sm text-[#e57373]">{error}</p>}

      {total === 0 ? (
        <div className="card p-4 text-center">
          <p className="mb-3 text-sm text-ink-mid">
            Start your library from the built-in set — you can edit and retire any of them after.
          </p>
          <button
            onClick={() => api("POST", { import: true })}
            disabled={busy}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import the built-in messages"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">
          {activeCount} active · {total} total — today shows #{" "}
          {(() => {
            const active = quotes.filter((q) => q.active);
            if (active.length === 0) return "—";
            const now = new Date();
            const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
            return ((day % active.length) + active.length) % active.length + 1;
          })()}
        </p>
      )}

      {/* Add a new one */}
      <div className="card space-y-2 p-3">
        <p className="eyebrow">Add a message</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="A thought worth carrying…"
          className="w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-[rgba(76,175,80,0.5)]"
        />
        <div className="flex gap-2">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author (optional)"
            className="flex-1 rounded-lg border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-1.5 text-sm text-ink outline-none focus:border-[rgba(76,175,80,0.5)]"
          />
          <button onClick={add} disabled={busy || !text.trim()} className="btn-primary text-sm disabled:opacity-50">
            Add
          </button>
        </div>
      </div>

      {/* The list */}
      <ul className="space-y-2">
        {quotes.map((q) => (
          <li
            key={q.id}
            className={`rounded-xl border p-3 ${q.active ? "border-[rgba(255,255,255,0.08)]" : "border-[rgba(255,255,255,0.05)] opacity-50"}`}
          >
            {editingId === q.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[rgba(76,175,80,0.4)] bg-transparent px-3 py-2 text-sm text-ink outline-none"
                />
                <div className="flex gap-2">
                  <input
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    placeholder="Author (optional)"
                    className="flex-1 rounded-lg border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-1.5 text-sm text-ink outline-none"
                  />
                  <button onClick={() => saveEdit(q.id)} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{q.text}</p>
                  {q.author && <p className="mt-0.5 text-xs text-ink-soft">— {q.author}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1 text-xs">
                  <button
                    onClick={() => api("PATCH", { id: q.id, active: !q.active })}
                    disabled={busy}
                    title={q.active ? "Hide from rotation" : "Add back to rotation"}
                    className="rounded-md px-2 py-1 text-ink-soft transition hover:text-ink"
                  >
                    {q.active ? "👁 On" : "🚫 Off"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(q.id);
                      setEditText(q.text);
                      setEditAuthor(q.author ?? "");
                    }}
                    className="rounded-md px-2 py-1 text-ink-soft transition hover:text-ink"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Retire this message for good?")) api("DELETE", undefined, `?id=${q.id}`);
                    }}
                    className="rounded-md px-2 py-1 text-ink-soft transition hover:text-[#e57373]"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
