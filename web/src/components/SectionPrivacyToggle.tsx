"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// A tiny per-section privacy pill the owner sees next to a profile section
// heading. Tapping flips public ⇄ private for that section. Optimistic, with a
// revert on failure.
export function SectionPrivacyToggle({
  section,
  initialPublic,
}: {
  section: "reflection" | "topics" | "seeds" | "aiTags" | "fingerprint";
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    setBusy(true);
    try {
      await apiPost("/api/me/privacy", { section, public: next });
    } catch {
      setIsPublic(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={isPublic}
      title={isPublic ? "Visible to everyone — tap to make private" : "Only you can see this — tap to make public"}
      className={
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition disabled:opacity-50 " +
        (isPublic
          ? "border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.08)] text-ink-mid"
          : "border-[var(--border)] text-ink-soft")
      }
    >
      {isPublic ? "🌐 Public" : "🔒 Only me"}
    </button>
  );
}
