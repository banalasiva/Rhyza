"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// A one-time, quiet notice + acknowledgment that a thread's messages are shared
// with the AI participants (Claude & ChatGPT) to generate replies. This is our
// in-context consent step — Google Play's User Data policy expects explicit,
// in-context consent before user content goes to a third-party AI, not just a
// line buried in the privacy page. Shown once per device the first time someone
// opens a thread; acknowledgment is remembered in localStorage. Calm, no jargon.

const KEY = "thinkthru_ai_consent";

// `active` = whether AI is actually on for the seed being viewed. We only raise
// the notice in a seed where messages really do go to the AI — never in an
// AI-off seed, where nothing is shared and the notice would be misleading.
export function AiConsent({ active = true }: { active?: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) return;
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* private mode — just don't show */
    }
  }, [active]);

  function ack() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How the AI helpers work"
        className="relative z-10 m-3 w-full max-w-sm rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[#0B120B] p-5 text-center shadow-xl"
      >
        <div className="mb-2 text-3xl">🌱</div>
        <p className="serif-lg mb-2">A quick heads-up</p>
        <p className="text-sm leading-relaxed text-ink-mid">
          To help you think, your messages in a thread are shared with{" "}
          <span className="text-ink">Claude</span> and <span className="text-ink">ChatGPT</span>{" "}
          to write replies — unless an owner or admin turns AI off. Nothing else leaves your
          circle.
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          More in our{" "}
          <Link href="/privacy" className="text-accent underline">
            privacy policy
          </Link>
          .
        </p>
        <button onClick={ack} className="btn-primary mt-4 w-full">
          Got it
        </button>
      </div>
    </div>
  );
}
