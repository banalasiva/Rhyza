import Link from "next/link";

// Public "About" page — the ThinkThru story, why it exists, and how to use it.
// Kept public (no auth) so anyone, including a shared link or a Play reviewer,
// can read it.
export const metadata = {
  title: "About · ThinkThru",
  description: "Why ThinkThru exists, and how to use it — turning conversations into decisions your group stands behind.",
};

export default function About() {
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <main className="relative z-10 mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm text-ink-soft transition hover:text-ink">
          ← ThinkThru
        </Link>

        {/* ── The hook ── */}
        <p className="eyebrow mt-6">🌱 About us</p>
        <h1 className="serif-xl mt-2">Every important decision begins with a conversation.</h1>

        <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-ink-mid">
          <p>But how often do great conversations disappear into endless chats?</p>
          <p>How often do teams lose the reasoning behind important decisions?</p>
          <p>How often do we wish we&apos;d asked one more question before deciding?</p>
        </div>

        <p className="mt-6 text-lg text-ink">
          That&apos;s why we built{" "}
          <span className="font-serif italic text-bloom">ThinkThru</span>.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-mid">
          A place where communities think together, build shared understanding, make better
          decisions, and grow wiser with every conversation. Whether you&apos;re building a product,
          choosing a school, planning a family vacation, designing software, running an organization,
          or leading a community — ThinkThru helps you think things through, together.
        </p>

        {/* ── Why ── */}
        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-ink-mid">
          <Section title="Why ThinkThru">
            <p>
              The decisions that matter are rarely made alone — they&apos;re talked through with the
              people we trust. But those conversations scatter across chats and calls, the reasoning
              behind the choice fades, and the quietest good idea often never gets heard. ThinkThru
              gives that thinking one calm home: every angle captured, every voice counted, and the
              decision — and the <em>why</em> behind it — kept for good.
            </p>
          </Section>

          {/* ── How to use ── */}
          <Section title="How to use ThinkThru">
            <p className="mb-3">Five simple steps turn a conversation into a decision:</p>
            <ol className="space-y-3">
              <Step n="1" title="Plant a garden">
                A private space for your group — your family, your team, your community. Invite the
                people who should be in the conversation.
              </Step>
              <Step n="2" title="Plant a seed">
                A seed is the real question you&apos;re weighing — “Which school?”, “Should we ship
                this?”, “Where do we go this summer?” Everything grows from the question.
              </Step>
              <Step n="3" title="Think it through together">
                Everyone adds their angle — the foundations, how to think about it, what it looks like
                in practice, and the honest debate. Stuck or want a fact? Tag{" "}
                <span className="text-accent">@claude</span> or{" "}
                <span className="text-accent">@chatgpt</span> right in the thread for a hand.
              </Step>
              <Step n="4" title="Weigh in">
                When it&apos;s time to decide, everyone weighs in — and the people with the most at
                stake carry the most say, so the call is fair, not just loudest.
              </Step>
              <Step n="5" title="Let it bloom">
                It settles into one clear decision, with the reasoning behind it, that your group
                keeps forever — so no one ever asks “wait, why did we decide this?” again.
              </Step>
            </ol>
          </Section>

          <Section title="What we believe">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>No one of us is as wise as all of us willing to listen.</li>
              <li>Every voice matters — and the quietest one often holds the wisdom the loudest miss.</li>
              <li>A decision made with everyone&apos;s honest voice in the room is one you rarely regret.</li>
              <li>Understanding together matters as much as deciding — the point is to think it through.</li>
            </ul>
          </Section>

          <Section title="Built to be trusted">
            <p>
              ThinkThru is private by default. Your gardens and seeds are yours; you choose what, if
              anything, to share. And it&apos;s made to feel self-intuitive for everyone at the table
              — from a ten-year-old to a grandparent.
            </p>
          </Section>

          <p className="border-t border-[rgba(255,255,255,0.08)] pt-6 text-sm text-ink-soft">
            Read our <Link href="/guidelines" className="text-accent hover:underline">community guidelines</Link>{" "}
            and <Link href="/privacy" className="text-accent hover:underline">privacy policy</Link>. Questions?
            Reach us at <a href="mailto:thinkthru.app@gmail.com" className="text-accent hover:underline">thinkthru.app@gmail.com</a>.
          </p>

          <div className="pt-2">
            <Link href="/" className="btn-primary text-sm">🌱 Start thinking together</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="serif-lg mb-2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(76,175,80,0.35)] text-xs font-semibold text-accent"
        aria-hidden
      >
        {n}
      </span>
      <span>
        <span className="font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-mid">{children}</span>
      </span>
    </li>
  );
}
