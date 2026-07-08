"use client";

import { useState } from "react";
import { shareOrCopy } from "@/lib/share-client";

// A standalone share control — opens the native share sheet, or copies the link
// with a brief "Copied" confirmation on desktop. Pass an app-relative `path`.
export function ShareButton({
  path,
  title,
  text,
  label = "Share",
  className,
  iconOnly = false,
}: {
  path: string;
  title: string;
  text?: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const result = await shareOrCopy({ path, title, text });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  // Icon-only: just the universal share glyph in a compact circle — saves the
  // row space a label would take (so e.g. "Hey Siva 👋" stays on one line).
  if (iconOnly) {
    return (
      <button
        onClick={onClick}
        aria-label="Share profile"
        title="Share"
        className={
          className ??
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(76,175,80,0.3)] text-accent transition hover:text-ink"
        }
      >
        <span aria-hidden className="text-base leading-none">{copied ? "✓" : "📤"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label="Share"
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.25)] px-3 py-1.5 text-sm text-ink-mid transition hover:text-ink"
      }
    >
      <span aria-hidden>{copied ? "✓" : "📤"}</span>
      {copied ? "Copied" : label}
    </button>
  );
}
