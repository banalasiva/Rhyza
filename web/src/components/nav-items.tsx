import type { ReactNode } from "react";

// The five main destinations, shared by the mobile bottom bar and the desktop
// top-header row so they never drift apart. Labels are always shown — words,
// not just icons, keep it obvious for first-timers and older users alike.
export type NavKey = "home" | "explore" | "search" | "alerts" | "you";

export const NAV_ITEMS: {
  href: string;
  label: string;
  key: NavKey;
  emoji: string;
  badge?: boolean;
}[] = [
  // `emoji` is used by the mobile bottom bar (warm, familiar, thumb-friendly);
  // `key` maps to a crisp line icon used by the desktop top nav (emoji look flat
  // on desktop). Same destinations, the right glyph for each surface.
  { href: "/", label: "Home", key: "home", emoji: "🏡" },
  { href: "/explore", label: "Explore", key: "explore", emoji: "🌍" },
  { href: "/search", label: "Search", key: "search", emoji: "🔍" },
  { href: "/notifications", label: "Alerts", key: "alerts", emoji: "🔔", badge: true },
  { href: "/roots", label: "You", key: "you", emoji: "🌳" },
];

// Crisp monochrome line icons (Feather style). They inherit `currentColor`, so
// they take the accent tint when a tab is active and render razor-sharp on
// desktop — unlike emoji, which look flat and differ across every OS.
export function NavIcon({ name, size = 22 }: { name: NavKey; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const paths: Record<NavKey, ReactNode> = {
    home: (
      <>
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </>
    ),
    explore: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
    alerts: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    you: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}
