"use client";

import { useEffect, useState } from "react";
import { speechSupported, speak, stopSpeaking } from "@/lib/voice";

// "Read aloud" — speaks the given text with the browser voice, so knowledge can
// be heard, not only read. Hides itself where speech synthesis isn't available.
export function ReadAloud({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(speechSupported());
    return () => stopSpeaking();
  }, []);

  if (!supported || !text?.trim()) return null;

  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, () => setSpeaking(false));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
      className={
        compact
          ? "inline-flex min-h-[24px] items-center gap-1 transition hover:text-ink"
          : "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1 text-xs text-ink-mid transition hover:text-ink"
      }
    >
      <span aria-hidden>{speaking ? "⏹" : "🔊"}</span>
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}
