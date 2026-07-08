import Link from "next/link";

// Public "About" page — the ThinkThru story and what it stands for. Kept public
// (no auth) so anyone, including a shared link or a Play reviewer, can read it.
export const metadata = {
  title: "About · ThinkThru",
  description: "Why ThinkThru exists — turning conversations into decisions your group stands behind.",
};

export default function About() {
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <main className="relative z-10 mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm text-ink-soft transition hover:text-ink">
          ← ThinkThru
        </Link>

        <p className="eyebrow mt-6">🌱 About us</p>
        <h1 className="serif-xl mt-2">Every important decision begins with a conversation.</h1>

        <div className="mt-7 space-y-6 text-[15px] leading-relaxed text-ink-mid">
          <p>
            The decisions that shape our lives — where to live, what to do about a parent&apos;s
            health, how to spend a windfall, which school, which job, whether to move — are almost
            never made alone. They&apos;re talked through with the people we love and trust. But
            those conversations scatter across WhatsApp threads, dinner tables, and half-remembered
            phone calls, and the thinking gets lost.
          </p>
          <p>
            <strong className="text-ink">ThinkThru</strong> gives that thinking a home. It&apos;s a
            calm, private space where a family or a group can take a real question, explore it from
            every angle — together, and with AI alongside — and arrive at an answer everyone
            actually stands behind.
          </p>

          <Section title="🌱 How it grows">
            <p>
              We borrowed the shape from a garden, because that&apos;s how good thinking really
              works — slowly, together, and worth tending.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-ink">Plant a seed</strong> — a real question you&apos;re
                weighing.
              </li>
              <li>
                <strong className="text-ink">Discuss</strong> — everyone brings their angle:
                foundations, understanding, real-world practice, the honest debate.
              </li>
              <li>
                <strong className="text-ink">Weigh in</strong> — when it matters, the people with the
                most at stake carry the most say, so the call is fair, not just loud.
              </li>
              <li>
                <strong className="text-ink">Bloom</strong> — it settles into one clear decision your
                group keeps forever.
              </li>
            </ul>
          </Section>

          <Section title="🤝 What we believe">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>No one of us is as wise as all of us willing to listen.</li>
              <li>Every voice matters — and the quietest one often holds the wisdom the loudest miss.</li>
              <li>A decision made with everyone&apos;s honest voice in the room is one you rarely regret.</li>
              <li>Understanding together matters as much as deciding — the point is to think it through.</li>
            </ul>
          </Section>

          <Section title="🔒 Built to be trusted">
            <p>
              ThinkThru is private by default. Your gardens and seeds are yours; you choose what, if
              anything, to share. It&apos;s made to feel self-intuitive for everyone at the table —
              from a ten-year-old to a grandparent.
            </p>
          </Section>

          <Section title="✦ Who it&apos;s for">
            <p>
              Families making a hard call together. Friends planning something that matters. Teams
              deciding without the loudest voice winning. Anyone who&apos;d rather think it through
              than think it alone.
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
