"use client";

import { useState } from "react";

// The outside voice. Someone the decision affected says how it actually landed
// for them — their read of the outcome, whether they'd have done the same, and
// a note. Calm and quick; one thoughtful moment, not a survey.

const OUTCOMES = [
  { key: "better", label: "Better than I expected" },
  { key: "expected", label: "Met my expectations" },
  { key: "worse", label: "Worse than I expected" },
];
const SAME_AGAIN = [
  { key: "definitely_yes", label: "Definitely" },
  { key: "probably_yes", label: "Probably" },
  { key: "not_sure", label: "Not sure" },
  { key: "probably_no", label: "Probably not" },
  { key: "definitely_no", label: "No" },
];

export function CalibrateForm({ token, ownerName }: { token: string; ownerName: string }) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [sameAgain, setSameAgain] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pill = (active: boolean) =>
    `rounded-full border px-4 py-2.5 text-sm transition active:scale-95 ${
      active
        ? "border-bloom bg-[rgba(255,179,0,0.14)] text-bloom"
        : "border-[rgba(255,255,255,0.14)] text-ink-mid hover:text-ink"
    }`;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calibrate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, sameAgain, note }),
      });
      if (!res.ok) throw new Error("Couldn't save");
      setDone(true);
    } catch {
      setError("Couldn't save your read — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6 text-center">
        <div className="mb-2 text-3xl">🌱</div>
        <p className="serif-lg mb-1">Thank you</p>
        <p className="text-sm text-ink-mid">
          {ownerName} will see your honest read next to their own — that&apos;s how good judgment is
          built.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-ink">
          📈 Honestly — how did this turn out for you?
        </p>
        <div className="flex flex-col gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(outcome === o.key ? null : o.key)}
              className={pill(outcome === o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-ink">
          🌱 Would you have decided the same?
        </p>
        <div className="flex flex-wrap gap-2">
          {SAME_AGAIN.map((s) => (
            <button
              key={s.key}
              onClick={() => setSameAgain(sameAgain === s.key ? null : s.key)}
              className={pill(sameAgain === s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-2 text-sm font-medium text-ink">Anything you&apos;d want them to know?</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — the honest thing that's hard to say in person."
          className="input min-h-[100px] w-full text-[15px] leading-relaxed"
          maxLength={2000}
        />
      </div>

      {error && <p className="text-center text-sm text-[#e57373]">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || (!outcome && !sameAgain && !note.trim())}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send my honest read →"}
      </button>
    </div>
  );
}
