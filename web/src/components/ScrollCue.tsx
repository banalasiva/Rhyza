"use client";

import { useEffect, useState } from "react";

// A gentle "there's more below" hint for the login screen on mobile, where the
// demo card fills the first screen and the sign-in sits just beneath it. Taps to
// scroll, and fades away the moment you start scrolling yourself. Hidden on
// desktop, where everything is already side-by-side.
export function ScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: "smooth" })}
      aria-label="Scroll down to sign in"
      className={`fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-0.5 text-ink-soft transition-opacity duration-500 lg:hidden ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="text-[11px] font-medium">Sign in</span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-bounce"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}
