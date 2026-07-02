"use client";

import { useEffect, useState } from "react";

// Light/dark switch. Toggling adds/removes `light` on <html> (which re-defines
// the CSS variables in globals.css) and remembers the choice; a tiny inline
// script in the layout applies it before first paint so there's no flash.
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    const root = document.documentElement;
    root.classList.toggle("light", next);
    try {
      localStorage.setItem("tt-theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark theme" : "Light theme"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(76,175,80,0.25)] text-base transition hover:border-[rgba(76,175,80,0.5)]"
    >
      <span aria-hidden>{light ? "🌙" : "☀️"}</span>
    </button>
  );
}
