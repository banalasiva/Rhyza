"use client";

import { useState } from "react";
import { shareReflectionCard } from "@/lib/share-card";

// One-tap "share how I show up" — turns Claude's mirror (the bulleted reflection)
// into a warm identity card. Renders nothing until there's a reflection to share.
export function ShareReflectionButton({ text, name }: { text: string; name: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const points = text.split("\n").map((p) => p.trim()).filter(Boolean);
  if (points.length === 0) return null;

  const who = name?.trim() || "";
  const heading = who ? `How ${who.split(/\s+/)[0]} shows up` : "How I show up";

  async function onClick() {
    try {
      const how = await shareReflectionCard(
        {
          heading,
          points,
          footer: "thinkthru.app — where thinking leaves a trace",
        },
        {
          fileName: "thinkthru-how-i-show-up.png",
          shareText: `${heading} — my honest mirror on ThinkThru. https://thinkthru.app`,
        },
      );
      if (how === "downloaded") {
        setMsg("Saved — share it anywhere 🪞");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg("Couldn't make the card");
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3 text-right">
      <button onClick={onClick} className="btn-ghost px-4 py-1.5 text-xs">
        ↗ Share how I show up
      </button>
      {msg && <p className="mt-1 text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
