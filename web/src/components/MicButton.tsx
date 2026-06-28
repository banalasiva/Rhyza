"use client";

import { useEffect, useRef, useState } from "react";
import { recognitionSupported, createRecognition } from "@/lib/voice";

// Dictate into a composer with your voice. Calls onText with the transcript so
// the caller appends it to the draft. Hidden where speech recognition is
// unavailable, so it's a pure progressive enhancement.
export function MicButton({
  onText,
  disabled,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<ReturnType<typeof createRecognition>>(null);

  useEffect(() => {
    setSupported(recognitionSupported());
    return () => recRef.current?.stop();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = createRecognition();
    if (!r) return;
    recRef.current = r;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (t.trim()) onText(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
      title={listening ? "Stop dictation" : "Speak to write"}
      className="flex h-7 items-center rounded-md border px-2 text-sm transition hover:text-ink disabled:opacity-40"
      style={{
        borderColor: listening ? "rgba(229,115,115,0.6)" : "rgba(76,175,80,0.2)",
        color: listening ? "#e57373" : undefined,
      }}
    >
      <span aria-hidden>{listening ? "🔴" : "🎤"}</span>
    </button>
  );
}
