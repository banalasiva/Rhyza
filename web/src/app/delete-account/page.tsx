import Link from "next/link";

// Public account-deletion instructions — required by Google Play's account
// deletion policy, which needs a dedicated, publicly reachable URL (no login)
// where a user can find out how to delete their account and what data goes with
// it. Kept in step with the privacy policy: same operator, same contact.
export const metadata = {
  title: "Delete your account · ThinkThru",
  description: "How to delete your ThinkThru account and the data associated with it.",
};

const CONTACT = "thinkthru.app@gmail.com";
const OPERATOR = "an independent developer";
const SUBJECT = encodeURIComponent("Delete my ThinkThru account");
const BODY = encodeURIComponent(
  "Please delete my ThinkThru account and associated data.\n\n" +
    "Account email (the one you sign in with): \n",
);

export default function DeleteAccount() {
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <main className="relative z-10 mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <Link href="/" className="text-sm text-ink-soft transition hover:text-ink">
          ← ThinkThru
        </Link>
        <h1 className="serif-xl mt-5">Delete your account</h1>
        <p className="mt-1 text-xs text-ink-soft">ThinkThru · operated by {OPERATOR}</p>

        <div className="mt-7 space-y-6 text-[15px] leading-relaxed text-ink-mid">
          <p>
            You can ask us to delete your ThinkThru account and the data tied to it at any time.
            We’ll take care of it — here’s exactly how, and what gets removed.
          </p>

          <Section title="How to request deletion">
            <p>
              Email us from the account you want deleted (or tell us which email you sign in with):
            </p>
            <a
              href={`mailto:${CONTACT}?subject=${SUBJECT}&body=${BODY}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[rgba(76,175,80,0.4)] px-4 py-2 text-sm text-ink transition hover:bg-[rgba(76,175,80,0.1)]"
            >
              ✉️ Email {CONTACT}
            </a>
            <p className="mt-3 text-sm text-ink-soft">
              Put “Delete my ThinkThru account” in the subject. So we can verify it’s really you,
              please send it from the email address you use to sign in.
            </p>
          </Section>

          <Section title="What gets deleted">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Your account and profile — your name, email address, and photo.</li>
              <li>The seeds (questions), messages, votes, rankings, and reactions you created.</li>
              <li>Your notification preferences and any push-notification subscriptions.</li>
            </ul>
            <p className="mt-2">
              We remove this within <strong className="text-ink">30 days</strong> of your request.
            </p>
          </Section>

          <Section title="What may be kept">
            <p>
              We may retain a limited amount of information only where the law requires it, or to
              resolve disputes and prevent abuse — and only for as long as needed. Content you
              shared inside a shared garden may remain visible to that group in an anonymised form
              (for example, “a member” instead of your name), so the group’s past decisions stay
              intact.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              Contact {OPERATOR} at{" "}
              <a href={`mailto:${CONTACT}`} className="text-accent underline">{CONTACT}</a>. See also
              our{" "}
              <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>.
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
