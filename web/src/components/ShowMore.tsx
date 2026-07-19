"use client";

import { Children, useState } from "react";

// Keeps long lists on the profile calm: shows the first few items (newest first,
// as ordered by the caller) and tucks the rest behind a "Show more" toggle.
// Purely presentational — the caller renders the items; we just gate how many
// are visible.
export function ShowMore({
  children,
  initial = 3,
  className = "space-y-2",
  noun = "more",
}: {
  children: React.ReactNode;
  initial?: number;
  className?: string;
  noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const rest = items.length - initial;
  const shown = open ? items : items.slice(0, initial);

  return (
    <>
      <div className={className}>{shown}</div>
      {rest > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 w-full rounded-lg border border-[rgba(255,255,255,0.1)] py-2 text-xs text-ink-soft transition hover:text-ink"
        >
          {open ? "Show less" : `Show ${rest} ${noun} →`}
        </button>
      )}
    </>
  );
}
