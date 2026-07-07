import Link from "next/link";

// Public community guidelines — what's welcome and what isn't, and how to report.
// Kept public (no auth) so anyone, including Play reviewers, can read them, and
// so removal notices can cite them.
export const metadata = {
  title: "Community Guidelines · ThinkThru",
  description: "What's welcome on ThinkThru, what isn't, and how to report content.",
};

const CONTACT = "thinkthru.app@gmail.com";
const UPDATED = "July 2026";

export default function Guidelines() {
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <main className="relative z-10 mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm text-ink-soft transition hover:text-ink">
          ← ThinkThru
        </Link>
        <h1 className="serif-xl mt-5">Community Guidelines</h1>
        <p className="mt-1 text-xs text-ink-soft">Last updated {UPDATED}</p>

        <div className="mt-7 space-y-6 text-[15px] leading-relaxed text-ink-mid">
          <p>
            ThinkThru is a calm space for families and groups to think things through together. To
            keep it safe and kind for everyone — from a 10-year-old to a grandparent — we ask
            everyone to follow a few simple guidelines.
          </p>

          <Section title="Be kind and respectful">
            <p>
              Disagree with ideas, never attack the person. No harassment, bullying, threats, hate
              speech, or content that demeans someone for who they are.
            </p>
          </Section>

          <Section title="Keep it safe and legal">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>No illegal content or activity.</li>
              <li>
                Nothing that sexualises or endangers children. We report child sexual abuse material
                to the authorities, always.
              </li>
              <li>No graphic violence, incitement to violence, or promotion of self-harm.</li>
              <li>No sexual or explicit content.</li>
            </ul>
          </Section>

          <Section title="Respect privacy and honesty">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Don&apos;t share someone else&apos;s private information without their consent.</li>
              <li>Don&apos;t impersonate other people.</li>
              <li>No spam, scams, or deliberately misleading content.</li>
            </ul>
          </Section>

          <Section title="If you see something">
            <p>
              Tap <strong className="text-ink">Report</strong> on a seed or a message. Reports go to
              our team, who review the flagged content and act on it — we don&apos;t browse private
              spaces; we only ever look at what&apos;s reported. You can also email{" "}
              <a href={`mailto:${CONTACT}`} className="text-accent underline">{CONTACT}</a>.
            </p>
          </Section>

          <Section title="What happens when a guideline is broken">
            <p>
              Depending on what happened, we may remove the content, warn the person, or remove their
              access. A garden or seed&apos;s own owner can also remove content within their space.
              We&apos;ll point to the guideline involved when we act.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              Email{" "}
              <a href={`mailto:${CONTACT}`} className="text-accent underline">{CONTACT}</a>. See also
              our <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>.
            </p>
          </Section>
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
