"use client";

import { useEffect, useRef, useState } from "react";

// A small ⓘ that reveals a plain-language explanation on tap — in-context help
// for the spots people get stuck. Tap-away or Esc closes it. Keep the text to a
// sentence or two; this is a nudge, not a manual.
export function InfoTip({ label, text }: { label?: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label={label ? `What is ${label}?` : "More info"}
        aria-expanded={open}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[rgba(255,255,255,0.25)] text-[10px] leading-none text-ink-soft transition hover:border-accent hover:text-ink"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-[rgba(76,175,80,0.3)] bg-[#0B120B] px-3 py-2 text-left text-[11px] leading-relaxed text-ink-mid shadow-xl"
        >
          {label && <span className="mb-0.5 block font-medium text-ink">{label}</span>}
          {text}
        </span>
      )}
    </span>
  );
}
