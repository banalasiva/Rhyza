"use client";

import { useState } from "react";
import { deriveFingerprint, type DimSlice } from "@/lib/fingerprint";
import { shareFingerprintCard } from "@/lib/share-card";

// One-tap "share my thinking fingerprint" — turns the dimension mix into the
// LinkedIn-friendly identity card. Nothing renders if there's no fingerprint yet.
export function ShareFingerprintButton({ dims, name }: { dims: DimSlice[]; name: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const fp = deriveFingerprint(dims);
  if (!fp) return null;

  const { primary, slices } = fp;
  const who = name?.trim() || "I";
  // "Siva thinks in Application." / "I think in Application." — the dimension
  // name (not the archetype tag) reads naturally in the possessive headline.
  const verb = who === "I" ? "think" : "thinks";
  const headline = `${who} ${verb} in ${primary.label}.`;

  async function onClick() {
    try {
      const how = await shareFingerprintCard(
        {
          headline,
          archetype: primary.tag,
          emoji: primary.emoji,
          color: primary.color,
          blurb: primary.blurb,
          slices: slices.map((s) => ({ label: s.label, emoji: s.emoji, color: s.color, pct: s.pct })),
          footer: "Grown on ThinkThru — where thinking leaves a trace.",
        },
        {
          fileName: "thinkthru-fingerprint.png",
          shareText: `${headline} My thinking fingerprint on ThinkThru. https://thinkthru.app`,
        },
      );
      if (how === "downloaded") {
        setMsg("Saved — share it anywhere 🧭");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg("Couldn't make the card");
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div className="mt-3 text-right">
      <button onClick={onClick} className="btn-ghost px-4 py-1.5 text-xs">
        ↗ Share fingerprint
      </button>
      {msg && <p className="mt-1 text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
