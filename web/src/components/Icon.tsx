"use client";

import { useId } from "react";

// On-theme line icons: a green→gold gradient stroke (the garden/bloom palette)
// with a soft glow so they read as gently dimensional against the dark bg.
// One cohesive set replacing scattered emoji across the seed UI.

export type IconName =
  | "discussion"
  | "polls"
  | "quorum"
  | "evolve"
  | "delete"
  | "info"
  | "attach"
  | "bloom";

const GLYPHS: Record<IconName, React.ReactNode> = {
  // speech bubble with a tail
  discussion: (
    <path d="M4 6.5C4 5.7 4.7 5 5.5 5h13c.8 0 1.5.7 1.5 1.5v6.5c0 .8-.7 1.5-1.5 1.5H9.5L5 18.5V15H5.5C4.7 15 4 14.3 4 13.5z" />
  ),
  // ascending bars on a baseline
  polls: (
    <>
      <path d="M3.5 19.5h17" />
      <path d="M6.5 19.5V12" />
      <path d="M12 19.5V5.5" />
      <path d="M17.5 19.5v-5" />
    </>
  ),
  // balance scale
  quorum: (
    <>
      <path d="M12 5v14" />
      <path d="M8 19.5h8" />
      <path d="M4 8h16" />
      <path d="M12 5.2a1 1 0 1 0 .01 0" />
      <path d="M4 8 1.6 13a3 3 0 0 0 4.8 0z" />
      <path d="M20 8l-2.4 5a3 3 0 0 0 4.8 0z" />
    </>
  ),
  // circular refresh / evolve
  evolve: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.7 4.5V8h-3.5" />
    </>
  ),
  // trash
  delete: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.6h5V7" />
      <path d="M6.2 7 7.2 19.4h9.6L17.8 7" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11.2v4.8M12 8.2h.01" />
    </>
  ),
  // paperclip
  attach: <path d="M16.5 7 9.8 13.7a2.6 2.6 0 0 0 3.7 3.7L20 10.9a4.4 4.4 0 1 0-6.2-6.2L6.4 12a6.2 6.2 0 0 0 8.8 8.8" />,
  // five-petal bloom
  bloom: (
    <>
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 9.7c.6-2.2.2-4.4-.0-5.2-.2.8-.6 3-.0 5.2" />
      <path d="M14.3 12c2.2-.6 4-2 4.6-2.6-.8.2-2.8.8-4.6 2.6" />
      <path d="M13.4 14.1c1.4 1.8 3.4 2.8 4.2 3-.4-.7-1.6-2.6-4.2-3" />
      <path d="M10.6 14.1c-1.4 1.8-3.4 2.8-4.2 3 .4-.7 1.6-2.6 4.2-3" />
      <path d="M9.7 12c-2.2-.6-4-2-4.6-2.6.8.2 2.8.8 4.6 2.6" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className,
  muted = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  muted?: boolean;
}) {
  const uid = useId();
  const gid = `ic-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{
        filter: muted ? "none" : "drop-shadow(0 0 3px rgba(124,223,143,0.35))",
        opacity: muted ? 0.55 : 1,
        transition: "opacity 0.2s",
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={muted ? "#9aa090" : "#8BE59B"} />
          <stop offset="1" stopColor={muted ? "#9aa090" : "#FFC24D"} />
        </linearGradient>
      </defs>
      <g
        stroke={`url(#${gid})`}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[name]}
      </g>
    </svg>
  );
}
