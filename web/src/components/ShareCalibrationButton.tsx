"use client";

import { useState } from "react";
import type { ReflectionSummary } from "@/lib/services/reflections";
import { shareCalibrationCard } from "@/lib/share-card";

// Opt-in "share my track record" — the "looking back" mirror is private by
// default; this lets a person CHOOSE to turn their own calls into a card. Honest
// by construction: it counts how many decisions landed as well as they hoped or
// better (a self-reviewed track record), never a claim of externally-graded
// accuracy. Renders only once there's enough reviewed to be meaningful.
export function ShareCalibrationButton({
  summary,
  insight,
}: {
  summary: ReflectionSummary;
  insight: string | null;
}) {
  const [msg, setMsg] = useState<string | null>(null);

  const { better, expected, worse } = summary.outcome;
  const total = better + expected + worse;
  // Need a few landed outcomes before a fraction says anything real.
  if (total < 3) return null;

  const right = better + expected; // landed as expected or better
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  async function onClick() {
    try {
      const how = await shareCalibrationCard(
        {
          bigNumber: `${right} / ${total}`,
          label: "landed as well as I hoped — or better",
          insight: insight ?? undefined,
          segs: [
            { pct: pct(better), color: "#66BB6A", label: "Better" },
            { pct: pct(expected), color: "#FFB300", label: "As expected" },
            { pct: pct(worse), color: "#e57373", label: "Harder" },
          ],
          footer: "A self-reviewed track record · ThinkThru",
        },
        {
          fileName: "thinkthru-calibration.png",
          shareText: `${right} of ${total} of my calls landed as well as I hoped — or better. My judgement track record on ThinkThru. https://thinkthru.app`,
        },
      );
      if (how === "downloaded") {
        setMsg("Saved — share it if you like 📈");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg("Couldn't make the card");
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div className="text-right">
      <button onClick={onClick} className="btn-ghost px-4 py-1.5 text-xs">
        ↗ Share my track record
      </button>
      <p className="mt-1 text-[11px] text-ink-soft">
        Private by default — this shares only if you choose to.
      </p>
      {msg && <p className="mt-1 text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
