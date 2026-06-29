"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/client";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; image: string | null; role: string; isYou: boolean };
type Dimension = {
  key: string;
  emoji: string;
  label: string;
  question: string;
  color: string;
  measurable: boolean;
};
type Gap = {
  dimension: string;
  self: number | null;
  room: number;
  direction: "above" | "below" | "aligned" | "unseen";
};
type Result = {
  weights: Record<string, number>;
  dimensionPies: Record<string, Record<string, number>>;
  dimensionLeader: Record<string, string | null>;
  hardcodedBy: Record<string, string | null>;
  carriesId: string | null;
  tensions: { text: string }[];
  myGap: Gap[];
};
type View = {
  phase: "collecting" | "revealed" | "locked";
  canManage: boolean;
  ownerId: string;
  people: Person[];
  dimensions: Dimension[];
  maxRank: number;
  mine: Record<string, string[]>;
  youSubmitted: boolean;
  submittedCount: number;
  totalPeople: number;
  hardcodes: Record<string, { byName: string; shares: Record<string, number> }>;
  result: Result | null;
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function QuorumV2({ seedId }: { seedId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setView(await apiGet<View>(`/api/seeds/${seedId}/quorum`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the quorum");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId]);

  if (error) return <p className="py-6 text-center text-sm text-[#e57373]">{error}</p>;
  if (!view) return <p className="py-6 text-center text-sm text-ink-soft">Loading the quorum…</p>;

  const showWeighIn = view.phase === "collecting";

  return (
    <div className="space-y-4">
      <header className="text-center">
        <h2 className="serif-lg">The Quorum</h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-mid">
          Everyone reads everyone — who carries the money, the effort, the heart, the
          call. We turn those reads into one fair weight. You&apos;re one voice, yourself
          included.
        </p>
      </header>

      {view.canManage && <AdminBar view={view} seedId={seedId} busy={busy} setBusy={setBusy} reload={load} setError={setError} />}

      {showWeighIn ? (
        <WeighIn view={view} seedId={seedId} reload={load} />
      ) : view.result ? (
        <Reveal view={view} result={view.result} />
      ) : (
        <p className="py-6 text-center text-sm text-ink-soft">The quorum is being tallied…</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Weigh-in — one dimension at a time, rank people best-first.
// ─────────────────────────────────────────────────────────────
function WeighIn({ view, seedId, reload }: { view: View; seedId: string; reload: () => Promise<void> }) {
  const dims = view.dimensions;
  const [step, setStep] = useState(0);
  const [ranks, setRanks] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const d of dims) init[d.key] = [...(view.mine[d.key] ?? [])];
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);

  const dim = dims[step];
  const nameOf = useMemo(() => {
    const m = new Map(view.people.map((p) => [p.id, p]));
    return (id: string) => m.get(id);
  }, [view.people]);

  const ranked = ranks[dim.key] ?? [];
  const pool = view.people.filter((p) => !ranked.includes(p.id));
  const atCap = ranked.length >= view.maxRank;

  function setDimRanks(next: string[]) {
    setRanks((r) => ({ ...r, [dim.key]: next }));
  }
  function add(id: string) {
    if (atCap) return;
    setDimRanks([...ranked, id]);
  }
  function remove(id: string) {
    setDimRanks(ranked.filter((x) => x !== id));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= ranked.length) return;
    const next = [...ranked];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setDimRanks(next);
  }

  async function save(submit: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiPut(`/api/seeds/${seedId}/quorum`, { ballots: ranks, submit });
      if (submit) {
        setDone(true);
        await reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  const allRanked = dims.every((d) => (ranks[d.key]?.length ?? 0) > 0);
  const isLast = step === dims.length - 1;

  if (done) {
    return (
      <div className="card p-6 text-center">
        <div className="mb-2 text-3xl">🤝</div>
        <p className="serif-lg mb-1">Your read is in.</p>
        <p className="text-xs text-ink-mid">
          {view.submittedCount} of {view.totalPeople} have weighed in. When the room is
          ready, an admin reveals how the weight settles.
        </p>
        <button onClick={() => setDone(false)} className="btn-ghost mt-4 text-xs">
          Change my answers
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* progress dots */}
      <div className="flex items-center justify-center gap-1.5 border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
        {dims.map((d, i) => (
          <button
            key={d.key}
            onClick={() => setStep(i)}
            aria-label={d.label}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === step ? 22 : 8,
              background: i === step ? d.color : (ranks[d.key]?.length ?? 0) > 0 ? "rgba(76,175,80,0.6)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>

      <div className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">{dim.emoji}</span>
          <span className="text-[11px] uppercase tracking-wide text-ink-soft">
            {dim.label} · {step + 1} of {dims.length}
          </span>
        </div>
        <p className="serif-lg mb-1">{dim.question}</p>
        <p className="mb-3 text-[11px] text-ink-soft">
          Rank who most embodies this — drag, or tap to add then use ↑↓. Up to {view.maxRank}.
        </p>

        {/* ranked list */}
        {ranked.length > 0 ? (
          <ol className="mb-3 space-y-1.5">
            {ranked.map((id, i) => {
              const p = nameOf(id);
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag !== null && drag !== i) move(drag, i);
                    setDrag(null);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-2 py-1.5"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-accent">{i + 1}</span>
                  <Avatar name={p?.name ?? "?"} image={p?.image ?? null} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {p?.name ?? "Someone"} {p?.isYou && <span className="text-ink-soft">(you)</span>}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="rounded px-1.5 py-0.5 text-ink-soft transition hover:text-ink disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, i + 1)} disabled={i === ranked.length - 1} aria-label="Move down" className="rounded px-1.5 py-0.5 text-ink-soft transition hover:text-ink disabled:opacity-30">↓</button>
                    <button onClick={() => remove(id)} aria-label="Remove" className="rounded px-1.5 py-0.5 text-ink-soft transition hover:text-[#e57373]">✕</button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mb-3 rounded-xl border border-dashed border-[rgba(255,255,255,0.12)] px-3 py-4 text-center text-xs text-ink-soft">
            Tap someone below to start ranking.
          </p>
        )}

        {/* pool */}
        {pool.length > 0 && (
          <div className="mb-1">
            <p className="mb-1.5 text-[11px] text-ink-soft">{atCap ? `That's the max (${view.maxRank}).` : "Tap to add:"}</p>
            <div className="flex flex-wrap gap-1.5">
              {pool.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  disabled={atCap}
                  className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.12)] py-1 pl-1 pr-2.5 text-xs text-ink-mid transition hover:border-[rgba(76,175,80,0.4)] hover:text-ink disabled:opacity-40"
                >
                  <Avatar name={p.name} image={p.image} size={20} />
                  <span className="max-w-[110px] truncate">{p.name}{p.isYou ? " (you)" : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-xs text-[#e57373]">{error}</p>}

      {/* nav */}
      <div className="flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.06)] px-4 py-3">
        <button
          onClick={() => (step === 0 ? save(false) : setStep(step - 1))}
          disabled={busy}
          className="btn-ghost text-xs disabled:opacity-50"
        >
          {step === 0 ? "Save draft" : "← Back"}
        </button>
        {isLast ? (
          <button
            onClick={() => save(true)}
            disabled={busy || !allRanked}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {busy ? "Submitting…" : allRanked ? "Submit my read" : "Rank every dimension"}
          </button>
        ) : (
          <button onClick={() => setStep(step + 1)} className="btn-primary text-sm">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reveal — four layers.
// ─────────────────────────────────────────────────────────────
function Reveal({ view, result }: { view: View; result: Result }) {
  const people = view.people;
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id) : undefined);
  const dimLabel = (key: string) => view.dimensions.find((d) => d.key === key)?.label ?? key;
  const [openDim, setOpenDim] = useState<string | null>(null);

  const ordered = [...people].sort((a, b) => (result.weights[b.id] ?? 0) - (result.weights[a.id] ?? 0));
  const max = Math.max(0.0001, ...ordered.map((p) => result.weights[p.id] ?? 0));

  const hardcodedDims = view.dimensions.filter((d) => result.hardcodedBy[d.key]);
  const gapNotes = result.myGap.filter((g) => g.direction !== "aligned");

  return (
    <div className="space-y-4">
      {/* Layer 1 — who carries */}
      <section className="card p-4">
        <h3 className="mb-0.5 text-sm font-semibold text-ink">⚖️ How the weight settled</h3>
        <p className="mb-3 text-[11px] text-ink-soft">Each person&apos;s share of the decision, read by the whole room.</p>
        <ul className="space-y-2">
          {ordered.map((p) => {
            const w = result.weights[p.id] ?? 0;
            const lead = p.id === result.carriesId;
            return (
              <li key={p.id} className="flex items-center gap-2.5">
                <Avatar name={p.name} image={p.image} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-ink">
                      {p.name} {p.isYou && <span className="text-ink-soft">(you)</span>}
                      {lead && <span className="ml-1 text-[10px] text-accent">carries most</span>}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-ink">{pct(w)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
                    <div className="h-full rounded-full" style={{ width: `${(w / max) * 100}%`, background: lead ? "#FFB300" : "rgba(76,175,80,0.7)" }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* per-dimension breakdown */}
        <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <p className="mb-2 text-[11px] text-ink-soft">Where it came from:</p>
          <div className="flex flex-wrap gap-1.5">
            {view.dimensions.map((d) => {
              const leader = nameOf(result.dimensionLeader[d.key]);
              return (
                <button
                  key={d.key}
                  onClick={() => setOpenDim(openDim === d.key ? null : d.key)}
                  className="rounded-full border border-[rgba(255,255,255,0.12)] px-2.5 py-1 text-[11px] text-ink-mid transition hover:text-ink"
                >
                  {d.emoji} {d.label}
                  {leader && <span className="text-ink-soft"> · {leader.name.split(" ")[0]}</span>}
                </button>
              );
            })}
          </div>
          {openDim && (
            <div className="mt-2 rounded-xl bg-[rgba(255,255,255,0.03)] p-3">
              <p className="mb-2 text-[11px] text-ink-soft">
                {view.dimensions.find((d) => d.key === openDim)?.question}
                {result.hardcodedBy[openDim] && <span className="text-accent"> · set by {result.hardcodedBy[openDim]}</span>}
              </p>
              <ul className="space-y-1.5">
                {[...people]
                  .map((p) => ({ p, v: result.dimensionPies[openDim]?.[p.id] ?? 0 }))
                  .sort((a, b) => b.v - a.v)
                  .filter((x) => x.v > 0)
                  .map(({ p, v }) => (
                    <li key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 truncate text-ink-mid">{p.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                        <div className="h-full rounded-full" style={{ width: pct(v), background: view.dimensions.find((d) => d.key === openDim)?.color }} />
                      </div>
                      <span className="w-9 shrink-0 text-right text-ink-soft">{pct(v)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Layer 2 — the admin's hand */}
      {hardcodedDims.length > 0 && (
        <section className="card p-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">📌 What an admin pinned</h3>
          <ul className="space-y-1">
            {hardcodedDims.map((d) => (
              <li key={d.key} className="text-xs text-ink-mid">
                {d.emoji} <span className="text-ink">{d.label}</span> was set from a ground truth by{" "}
                <span className="text-accent">{result.hardcodedBy[d.key]}</span> — not read by the room.
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Layer 3 — your private mirror */}
      <section className="card p-4">
        <h3 className="mb-1 text-sm font-semibold text-ink">🪞 Your mirror</h3>
        <p className="mb-2 text-[11px] text-ink-soft">Only you see this — how the room read you, next to how you read yourself.</p>
        {gapNotes.length === 0 ? (
          <p className="text-xs text-ink-mid">You and the room are aligned across the board. 🤝</p>
        ) : (
          <ul className="space-y-1.5">
            {gapNotes.map((g) => (
              <li key={g.dimension} className="text-xs text-ink-mid">
                <span className="text-ink">{dimLabel(g.dimension)}:</span>{" "}
                {g.direction === "above" && "the room sees you carrying less here than you placed yourself."}
                {g.direction === "below" && "the room sees you carrying more here than you placed yourself."}
                {g.direction === "unseen" && "the room reads you here, though you didn't rank yourself."}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Layer 4 — public tensions */}
      {result.tensions.length > 0 && (
        <section className="card border-[rgba(255,179,0,0.3)] bg-[rgba(255,179,0,0.06)] p-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">⚡ Worth a word</h3>
          <ul className="space-y-1.5">
            {result.tensions.map((t, i) => (
              <li key={i} className="text-xs text-ink-mid">{t.text}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Admin bar — phase control + hardcode editor.
// ─────────────────────────────────────────────────────────────
function AdminBar({
  view,
  seedId,
  busy,
  setBusy,
  reload,
  setError,
}: {
  view: View;
  seedId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [hardcodeDim, setHardcodeDim] = useState<string | null>(null);
  const measurable = view.dimensions.filter((d) => d.measurable);

  async function phase(next: "collecting" | "revealed" | "locked") {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/seeds/${seedId}/quorum`, { phase: next });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change phase");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[rgba(255,179,0,0.25)] bg-[rgba(255,179,0,0.05)] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-soft">Admin · {view.phase}</p>
      <div className="flex flex-wrap gap-2">
        {view.phase === "collecting" && (
          <button onClick={() => phase("revealed")} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
            Reveal the quorum ({view.submittedCount}/{view.totalPeople} in)
          </button>
        )}
        {view.phase === "revealed" && (
          <>
            <button onClick={() => phase("locked")} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
              🔒 Lock for the bloom
            </button>
            <button onClick={() => phase("collecting")} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
              Reopen weigh-in
            </button>
          </>
        )}
        {view.phase === "locked" && (
          <button onClick={() => phase("revealed")} disabled={busy} className="btn-ghost text-xs disabled:opacity-50">
            Unlock
          </button>
        )}
      </div>

      {view.phase !== "locked" && (
        <div className="mt-3 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <p className="mb-1.5 text-[11px] text-ink-soft">Know a hard number? Pin a measurable dimension:</p>
          <div className="flex flex-wrap gap-1.5">
            {measurable.map((d) => (
              <button
                key={d.key}
                onClick={() => setHardcodeDim(hardcodeDim === d.key ? null : d.key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  view.hardcodes[d.key]
                    ? "border-[rgba(76,175,80,0.4)] text-accent"
                    : "border-[rgba(255,255,255,0.12)] text-ink-mid hover:text-ink"
                }`}
              >
                {d.emoji} {d.label}{view.hardcodes[d.key] ? " · pinned" : ""}
              </button>
            ))}
          </div>
          {hardcodeDim && (
            <HardcodeEditor
              key={hardcodeDim}
              view={view}
              seedId={seedId}
              dimension={hardcodeDim}
              onDone={async () => {
                setHardcodeDim(null);
                await reload();
              }}
              setError={setError}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HardcodeEditor({
  view,
  seedId,
  dimension,
  onDone,
  setError,
}: {
  view: View;
  seedId: string;
  dimension: string;
  onDone: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const dim = view.dimensions.find((d) => d.key === dimension);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const existing = view.hardcodes[dimension]?.shares ?? {};
    for (const p of view.people) init[p.id] = existing[p.id] != null ? String(existing[p.id]) : "";
    return init;
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const shares: Record<string, number> = {};
    for (const [id, v] of Object.entries(vals)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) shares[id] = n;
    }
    try {
      await apiPost(`/api/seeds/${seedId}/quorum`, { dimension, shares });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't pin");
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/seeds/${seedId}/quorum`, { dimension, clear: true });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't clear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl bg-[rgba(255,255,255,0.03)] p-3">
      <p className="mb-2 text-[11px] text-ink-soft">
        {dim?.question} Enter any numbers (shares, %, ₹, equity) — we normalise them.
        Leave blank for none.
      </p>
      <ul className="space-y-1.5">
        {view.people.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Avatar name={p.name} image={p.image} size={22} />
            <span className="min-w-0 flex-1 truncate text-xs text-ink-mid">{p.name}</span>
            <input
              inputMode="decimal"
              value={vals[p.id] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))}
              placeholder="—"
              className="w-20 rounded-lg border border-[rgba(255,255,255,0.12)] bg-transparent px-2 py-1 text-right text-xs text-ink outline-none focus:border-[rgba(76,175,80,0.5)]"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        {view.hardcodes[dimension] ? (
          <button onClick={clear} disabled={busy} className="text-[11px] text-ink-soft transition hover:text-[#e57373] disabled:opacity-50">
            Clear pin
          </button>
        ) : (
          <span />
        )}
        <button onClick={save} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
          {busy ? "Pinning…" : "Pin this"}
        </button>
      </div>
    </div>
  );
}
