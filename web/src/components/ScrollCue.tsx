"use client";

import { useEffect, useState } from "react";

// A big, clear "keep scrolling" cue for the landing story — a glowing round
// button with a large bouncing chevron. Taps to scroll a screenful, and fades
// away the moment you start scrolling yourself.
export function ScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: "smooth" })}
      aria-label="Scroll down"
      className={`fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 transition-opacity duration-500 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="text-xs font-medium text-ink-soft">Scroll</span>
      <span
        className="flex h-12 w-12 animate-bounce items-center justify-center rounded-full border text-accent"
        style={{
          borderColor: "rgba(76,175,80,0.55)",
          background: "rgba(76,175,80,0.12)",
          boxShadow: "0 0 22px rgba(76,175,80,0.3)",
        }}
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}
