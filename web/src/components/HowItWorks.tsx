"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { DIMENSIONS } from "@/lib/constants";

// ThinkThru's welcome + how-it-works. Shown on a member's first seed visit and from
// the "ⓘ How it works" button. Leads with the why (preserving the journey behind
// a decision), then how a Seed grows into shared wisdom.
export function HowItWorks({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Dialog behaviour (WCAG 2.1.2 / 2.4.3): Esc closes, focus moves in on open.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[rgba(8,5,0,0.74)] px-4 py-8 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hiw-title"
        className="card relative z-10 max-h-full w-full max-w-xl overflow-auto p-7 animate-[fadeUp_0.4s_ease-out]"
      >
        {/* ── Welcome ── */}
        <div className="text-center">
          <Image src="/emblem.png" alt="" width={56} height={56} className="mx-auto h-14 w-14" />
          <h2 id="hiw-title" className="serif-xl mt-1">Welcome to ThinkThru</h2>
          <p className="mt-1 text-sm text-ink-soft">The 10-second version:</p>
        </div>

        {/* The fast path — three steps anyone gets at a glance. The depth is
            below for whoever wants it. */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { e: "💬", t: "Discuss", d: "Bring a question and talk it through together." },
            { e: "⚖️", t: "Decide", d: "Everyone weighs in; the Quorum finds one fair call." },
            { e: "🌸", t: "Bloom", d: "It settles into a decision, remembered forever." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border border-[rgba(76,175,80,0.15)] bg-[rgba(7,13,7,0.4)] p-3">
              <div className="text-2xl" aria-hidden>{s.e}</div>
              <p className="mt-1 text-sm font-medium text-ink">{s.t}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-ink-soft">— or, the longer story —</p>

        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-mid">
          <p className="text-ink">Every important decision begins with a conversation.</p>
          <ul className="space-y-0.5 text-ink-soft">
            <li>Choosing a school for your child.</li>
            <li>Designing a product.</li>
            <li>Making an investment.</li>
            <li>Planning a family trip.</li>
          </ul>
          <p>
            People ask questions, share perspectives, disagree, and eventually
            arrive at a decision.
          </p>
          <p>But as time passes, the conversation fades.</p>
          <p>Someone eventually asks,</p>
          <blockquote className="border-l-2 border-[rgba(255,179,0,0.5)] pl-4 font-serif text-lg text-bloom">
            “Why did we choose this?”
          </blockquote>
          <p>The answer is rarely just the decision.</p>
          <p>
            It&apos;s the reasoning, the trade-offs, the people who shaped it, and
            the journey that led there.
          </p>
          <p className="text-base font-medium text-ink">
            ThinkThru exists to preserve that journey.
          </p>
          <p>
            Inspired by nature&apos;s hidden root networks, where countless
            connections help entire forests thrive, ThinkThru helps communities grow
            conversations into collective intelligence.
          </p>
        </div>

        <hr className="my-6 border-[rgba(76,175,80,0.18)]" />

        {/* ── How it works ── */}
        <p className="eyebrow mb-4 text-center">How it works</p>

        <Section emoji="🌱" title="Every conversation begins as a Seed.">
          <p>
            Ask a question, propose an idea, or start a decision. Every Seed
            belongs to the community — not just the person who created it.
          </p>
        </Section>

        <Section emoji="🧠" title="Grow the Seed together.">
          <p className="mb-2">Every Seed is explored through five perspectives:</p>
          <ul className="space-y-1">
            {DIMENSIONS.map((d) => (
              <li key={d.key}>
                {d.emoji} <strong style={{ color: d.color }}>{d.label}</strong> — {d.blurb}
              </li>
            ))}
          </ul>
        </Section>

        <Section emoji="🌿" title="Watch knowledge grow.">
          <p>
            As people contribute, question, and build on each other&apos;s ideas,
            the Seed grows from <em>Seed → Germinating → Sprouting → Growing →
            Bloomed</em>. The plant reflects the maturity of the conversation — not
            its popularity.
          </p>
        </Section>

        <Section emoji="🌳" title="Nothing is forgotten.">
          <p className="mb-2">
            When the community feels a Seed is ready, Claude helps distill the
            discussion into a Bloom. Every Bloom remembers:
          </p>
          <ul className="space-y-0.5">
            <li>• Why the decision was made.</li>
            <li>• Who contributed to it.</li>
            <li>• How the thinking evolved.</li>
          </ul>
          <p className="mt-2">
            It becomes part of your <strong>Sacred Tree</strong> — a living memory
            your community can return to for years.
          </p>
        </Section>

        <Section emoji="🤝" title="Think together.">
          <p>
            Claude can explain, summarize, and mediate discussions. The community
            decides what becomes its shared wisdom.
          </p>
        </Section>

        <p className="mb-5 mt-5 text-center font-serif text-lg leading-snug text-ink">
          Because conversations create decisions.
          <br />
          Communities create <span className="text-accent">wisdom</span>.
        </p>

        <button ref={closeRef} onClick={onClose} className="btn-primary w-full">
          Enter ThinkThru 🌿
        </button>
      </div>
    </div>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-[rgba(76,175,80,0.15)] bg-[rgba(7,13,7,0.4)] p-3.5">
      <p className="mb-1.5 flex items-center gap-2 font-medium text-ink">
        <span className="text-base">{emoji}</span>
        {title}
      </p>
      <div className="text-sm leading-relaxed text-ink-mid">{children}</div>
    </div>
  );
}
