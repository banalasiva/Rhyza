import Link from "next/link";

// Public privacy policy — required for the Play Store listing + Data Safety
// form. Intentionally not behind auth (Google's crawler and reviewers must
// reach it). Operated by an independent developer (no legal entity needed);
// contact is an email so the operator's real name and postal address stay off
// the public web — those live only in the Play Console identity verification,
// which Google keeps private.
export const metadata = {
  title: "Privacy Policy · ThinkThru",
  description: "How ThinkThru collects, uses, and protects your information.",
};

const UPDATED = "June 2026";
const CONTACT = "thinkthru.app@gmail.com";
const OPERATOR = "an independent developer";

export default function PrivacyPolicy() {
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <main className="relative z-10 mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm text-ink-soft transition hover:text-ink">
          ← ThinkThru
        </Link>
        <h1 className="serif-xl mt-5">Privacy Policy</h1>
        <p className="mt-1 text-xs text-ink-soft">Last updated {UPDATED}</p>

        <div className="mt-7 space-y-6 text-[15px] leading-relaxed text-ink-mid">
          <p>
            ThinkThru (&ldquo;we&rdquo;, the &ldquo;app&rdquo;), operated by {OPERATOR}, helps
            communities turn conversations into collective decisions. This policy explains
            what we collect, why, and the choices you have. Questions:{" "}
            <a href={`mailto:${CONTACT}`} className="text-accent underline">{CONTACT}</a>.
          </p>

          <Section title="What we collect">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-ink">Account</strong> — when you sign in with Google we
                receive your name, email address, and profile image. We do not see your Google
                password.
              </li>
              <li>
                <strong className="text-ink">Your content</strong> — the seeds (questions),
                messages, votes, rankings, and reactions you create in the app, including any
                photos, videos, or files you choose to attach.
              </li>
              <li>
                <strong className="text-ink">Preferences</strong> — your notification settings.
              </li>
              <li>
                <strong className="text-ink">Push tokens</strong> — if you enable push
                notifications, the subscription your browser/device issues so we can deliver them.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To provide the app — show your gardens, seeds, and the people in them.</li>
              <li>To send notifications you ask for (email and/or push), and a daily digest if enabled.</li>
              <li>
                To power AI features (summaries, mediation, the AI participants) — when you invoke
                them, the relevant discussion text is sent to our AI providers to generate a response.
                We ask you to acknowledge this in the app before you first use a thread, so it is
                never a surprise.
              </li>
              <li>To keep the service secure and prevent abuse.</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information, and we do not use it for advertising.
            </p>
          </Section>

          <Section title="Who processes it">
            <p>We share data only with the providers that run the service on our behalf:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-ink">Google</strong> — sign-in.</li>
              <li><strong className="text-ink">Vercel</strong> — application hosting.</li>
              <li><strong className="text-ink">Neon</strong> — database storage.</li>
              <li><strong className="text-ink">Anthropic</strong> and <strong className="text-ink">OpenAI</strong> — AI features (process discussion text you send them; not used to train their models on a basis we control, per their API terms).</li>
              <li><strong className="text-ink">Resend</strong> — transactional and digest email.</li>
            </ul>
          </Section>

          <Section title="Retention">
            <p>
              We keep your content and account data for as long as your account is active. You can
              ask us to delete your account and associated data at any time by emailing{" "}
              <a href={`mailto:${CONTACT}`} className="text-accent underline">{CONTACT}</a>; we will
              remove it within 30 days, except where we must retain something to comply with law.
            </p>
          </Section>

          <Section title="Your choices">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Turn email, push, and digest notifications on or off in Notifications settings.</li>
              <li>Unsubscribe from email via the link in any message.</li>
              <li>Request a copy of your data, or its deletion, by email.</li>
            </ul>
          </Section>

          <Section title="Children">
            <p>
              ThinkThru is not directed to children under 13 (or the minimum age in your country),
              and we do not knowingly collect their data.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update this policy; we&apos;ll change the date above and, for material changes,
              notify you in the app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              {OPERATOR} ·{" "}
              <a href={`mailto:${CONTACT}`} className="text-accent underline">{CONTACT}</a>
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
