"use client";

import { useState } from "react";

// Per-message Copy + Share. Copy puts the text on the clipboard; Share uses the
// native share sheet on mobile (Slack/WhatsApp/email/…) and falls back to a small
// menu of links on desktop. `only` renders just one of the two as a standalone
// button (so each can be its own cell in the action sheet); `className` styles it.
export function MessageActions({
  text,
  path,
  only,
  className,
}: {
  text: string;
  path: string;
  only?: "copy" | "share";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function urlFor() {
    return typeof window !== "undefined" ? window.location.origin + path : path;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
    setMenuOpen(false);
  }

  async function share() {
    const url = urlFor();
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : null;
    if (nav && "share" in nav) {
      try {
        await nav.share({ text, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to menu */
      }
    }
    setMenuOpen((o) => !o);
  }

  const url = urlFor();
  const payload = `${text}\n\n${url}`;
  const enc = encodeURIComponent(payload);
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc}` },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent("Shared from ThinkThru")}&body=${enc}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${enc}` },
  ];

  const btnClass = className ?? "transition hover:text-ink";

  // Standalone Copy — its own cell.
  if (only === "copy") {
    return (
      <button onClick={copy} aria-label="Copy message" className={btnClass}>
        {copied ? "✓ Copied" : "⧉ Copy"}
      </button>
    );
  }

  // Standalone Share — its own cell, with the desktop fallback menu anchored to it.
  if (only === "share") {
    return (
      <div className="relative">
        <button onClick={share} aria-label="Share message" className={`w-full ${btnClass}`}>
          ↗ Share
        </button>
        {menuOpen && (
          <>
            <button
              aria-label="Close share menu"
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute bottom-full left-0 z-40 mb-1 w-40 rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(10,16,10,0.98)] p-1 shadow-xl">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-2.5 py-1.5 text-xs text-ink-mid transition hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
              <button
                onClick={copy}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-mid transition hover:text-ink"
              >
                Copy text + link
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <span className="relative inline-flex items-center gap-3">
      <button onClick={copy} aria-label="Copy message" className="transition hover:text-ink">
        {copied ? "✓ Copied" : "⧉ Copy"}
      </button>
      <button onClick={share} aria-label="Share message" className="transition hover:text-ink">
        ↗ Share
      </button>

      {menuOpen && (
        <>
          {/* click-away */}
          <button
            aria-label="Close share menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute bottom-full right-0 z-40 mb-1 w-40 rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(10,16,10,0.98)] p-1 shadow-xl">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2.5 py-1.5 text-xs text-ink-mid transition hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <button
              onClick={copy}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-mid transition hover:text-ink"
            >
              Copy text + link
            </button>
          </div>
        </>
      )}
    </span>
  );
}
