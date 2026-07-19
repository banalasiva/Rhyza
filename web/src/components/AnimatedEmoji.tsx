"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// lottie-react touches `document` on import, so it must never run on the server.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Duolingo/Slack-style animated emoji. Renders Google's free Noto Animated Emoji
// (Lottie JSON, CDN-hosted) for a given codepoint. Everything degrades gracefully:
// while the JSON loads — or if the fetch/render fails, or the user prefers reduced
// motion — it shows the plain emoji glyph, so it can never render blank.
//
// The JSON is cached per-codepoint across the app (module-level Map) so a picker
// full of the same emoji, or re-opening a sheet, fetches each file at most once.

const cache = new Map<string, Promise<unknown>>();

function loadLottie(codepoint: string): Promise<unknown> {
  let p = cache.get(codepoint);
  if (!p) {
    p = fetch(`https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/lottie.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`lottie ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        cache.delete(codepoint); // let a later mount retry
        throw err;
      });
    cache.set(codepoint, p);
  }
  return p;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AnimatedEmoji({
  codepoint,
  emoji,
  size = 18,
  loop = true,
  animate = true,
  className,
}: {
  codepoint: string;
  emoji: string;
  size?: number;
  loop?: boolean;
  // When false, render the STATIC 3D Noto image (no motion) instead of the
  // Lottie — same rich icon, but it never plays/loops.
  animate?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<unknown | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const reduced = useRef(prefersReducedMotion());

  useEffect(() => {
    if (!animate || reduced.current) return; // static / reduced-motion — no fetch
    let alive = true;
    loadLottie(codepoint)
      .then((json) => {
        if (alive) setData(json);
      })
      .catch(() => {
        /* keep the static fallback */
      });
    return () => {
      alive = false;
    };
  }, [codepoint]);

  // Static mode: the rich 3D Noto still-image, no motion. Falls back to the
  // plain glyph if the image can't load.
  if (!animate) {
    if (imgFailed) {
      return (
        <span
          className={className}
          style={{ fontSize: size, lineHeight: 1, display: "inline-block" }}
          aria-hidden
        >
          {emoji}
        </span>
      );
    }
    return (
      <span
        className={className}
        style={{ width: size, height: size, display: "inline-block", lineHeight: 0 }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/512.png`}
          alt=""
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
          style={{ width: size, height: size, objectFit: "contain" }}
        />
      </span>
    );
  }

  // Static glyph: shown until the animation is ready, and as the permanent
  // fallback on failure / reduced-motion.
  if (!data) {
    return (
      <span
        className={className}
        style={{ fontSize: size, lineHeight: 1, display: "inline-block" }}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ width: size, height: size, display: "inline-block", lineHeight: 0 }}
      aria-hidden
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Lottie animationData={data as any} loop={loop} style={{ width: size, height: size }} />
    </span>
  );
}
