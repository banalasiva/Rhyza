import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { Reveal } from "@/components/Reveal";
import { authErrorMessage } from "@/lib/services/auth-events";
import { firebaseVerifyConfigured } from "@/lib/firebase-verify";

// Familiar decisions — "this is me."
const FAMILIAR = [
  "🏖️ Where should we go for our holiday?",
  "🏡 Should we buy this house?",
  "💼 Should I take the new job?",
  "🚀 Which feature should we build first?",
];

// The perspectives no one holds alone.
const PERSPECTIVES = [
  "💰 One person worries about the money.",
  "💪 Another about the effort.",
  "⚠️ Someone sees the risks.",
  "🌟 Someone sees the opportunity.",
  "❓ Someone asks the question everyone else missed.",
];

// The three steps — one clean idea each, not a shower of emoji.
const STEPS3 = [
  {
    emoji: "💬",
    title: "Discuss",
    body: "Discuss, debate, challenge ideas, hear every perspective — and ask AI when you need another point of view.",
  },
  {
    emoji: "⚖️",
    title: "Weigh in",
    body: "Who carries the money, the effort, the focus, the judgement — everyone votes on what matters most.",
  },
  {
    emoji: "🌸",
    title: "Bloom",
    body: "Into one shared understanding your community keeps — and remembers.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; next?: string };
}) {
  // Where to land after sign-in. Only same-site relative paths are honoured (no
  // open redirects), so a shared /calibrate link returns the person to it.
  const next =
    searchParams?.next && /^\/(?!\/)/.test(searchParams.next) ? searchParams.next : "/";
  const session = await auth();
  if (session?.user) redirect(next);

  const ssoEnabled = !!process.env.AUTH_SSO_ISSUER;
  const ssoName = process.env.AUTH_SSO_NAME || "SSO";
  const emailEnabled = !!process.env.RESEND_API_KEY;
  // Show phone sign-in only when it actually works end-to-end. Firebase config
  // being present isn't enough — SMS also needs the Firebase project on an active
  // Blaze plan. Since we can't detect billing from env, phone is an EXPLICIT
  // opt-in: it stays hidden until PHONE_SIGNIN_ENABLED="true" is set (flip it on
  // only after a real test sign-in succeeds). This keeps the Firebase config in
  // place while a pending billing review resolves, without showing a broken
  // "or with your phone" option.
  const phoneEnabled =
    process.env.PHONE_SIGNIN_ENABLED === "true" &&
    firebaseVerifyConfigured() &&
    !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const errorCode = searchParams?.error;

  return (
    <main id="main" className="relative flex min-h-screen flex-col items-center overflow-x-hidden px-6">
      <div className="garden-bg" />

      {/* Floating "what is this?" — always within reach at the bottom, for anyone
          who wants to know what ThinkThru is before signing in. Scrolls to the
          how-it-works story below. */}
      <a
        href="#how"
        className="fixed inset-x-0 bottom-5 z-30 mx-auto flex w-max items-center gap-1.5 rounded-full border border-[rgba(76,175,80,0.4)] bg-[rgba(7,13,7,0.85)] px-4 py-2 text-xs font-medium text-ink shadow-lg backdrop-blur transition hover:border-accent"
      >
        <span aria-hidden>🌱</span>
        What&apos;s ThinkThru?
        <span aria-hidden className="animate-bounce leading-none">↓</span>
      </a>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* ── The way in — clean, exactly like GitHub. Logo, a plain heading, the
            sign-in card. The whole story waits below the floating ↓. ── */}
        <section
          id="start"
          className="flex min-h-[100svh] scroll-mt-6 flex-col items-center justify-center py-10"
        >
          <Image
            src="/logo-source.png"
            alt="ThinkThru"
            width={200}
            height={200}
            priority
            className="mx-auto mb-4 h-auto w-28 sm:w-32"
          />
          <h1 className="serif-lg mb-6 text-2xl">Sign in to ThinkThru</h1>

          <div className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(7,13,7,0.6)] p-6 text-left backdrop-blur">
            {errorCode && (
              <AuthErrorBanner code={errorCode} message={authErrorMessage(errorCode)} />
            )}
            <AuthPanel
              defaultMode="signup"
              emailEnabled={emailEnabled}
              ssoEnabled={ssoEnabled}
              ssoName={ssoName}
              phoneEnabled={phoneEnabled}
              next={next}
              googleAction={async () => {
                "use server";
                await signIn("google", { redirectTo: next });
              }}
              emailAction={async (formData: FormData) => {
                "use server";
                const email = String(formData.get("email") || "").trim();
                if (!email) return;
                await signIn("resend", { email, redirectTo: next });
              }}
              ssoAction={async () => {
                "use server";
                await signIn("sso", { redirectTo: next });
              }}
            />
          </div>

          {/* No account? Just look around the public square, read-only. */}
          <Link
            href="/look"
            className="mt-4 text-sm text-ink-soft transition hover:text-ink"
          >
            or <span className="font-medium text-ink">look around first</span> — no account needed →
          </Link>
        </section>

        {/* ════════════════════════════════════════════════════════════
            Below the fold — the original story, unchanged. Font hierarchy,
            wording and pacing are exactly as they were; only pushed below the
            clean sign-in above.
            ════════════════════════════════════════════════════════════ */}

        {/* ── Beat 1 · the question ── */}
        <section
          id="how"
          className="flex min-h-[88vh] scroll-mt-6 flex-col items-center justify-center"
        >
          <h1 className="serif-xl mb-3 text-4xl text-bloom sm:text-5xl">
            Need to figure something out together?
          </h1>
          <p className="text-lg text-ink-soft">Like…</p>
          <div className="mt-6 space-y-2">
            {FAMILIAR.map((f, i) => (
              <Reveal key={f} delay={i * 80}>
                <p className="rounded-full border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.05)] px-4 py-2 text-sm text-ink-mid">
                  {f}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Beat 2 · a conversation ── */}
        <section className="flex min-h-[80vh] flex-col items-center justify-center">
          <Reveal>
            <p className="mb-2 font-serif text-lg italic text-ink-soft">Then…</p>
            <h2 className="serif-lg mb-3 text-2xl">Why is decision making so hard?</h2>
            <p className="text-lg text-ink-mid">Because no one sees the whole picture alone.</p>
          </Reveal>
          <div className="mt-7 space-y-2.5 text-left">
            {PERSPECTIVES.map((p, i) => (
              <Reveal key={p} delay={i * 90}>
                <p className="text-base text-ink-mid">{p}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-7">
            <p className="text-lg text-ink">
              The best decisions happen when <span className="text-bloom">every perspective</span> has
              a place.
            </p>
          </Reveal>
        </section>

        {/* ── Beat 3 · that's why → three steps ── */}
        <section className="flex min-h-[85vh] flex-col items-center justify-center">
          <Reveal>
            <p className="eyebrow mb-2">That’s why we built</p>
            <p className="mb-6 font-serif text-4xl italic text-bloom">ThinkThru</p>
            <p className="text-lg text-ink-mid">Bring everyone who matters into one conversation.</p>
          </Reveal>
          <div className="mt-7 w-full space-y-3 text-left">
            {STEPS3.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="rounded-2xl border border-[rgba(76,175,80,0.22)] bg-[rgba(76,175,80,0.05)] p-4">
                  <p className="text-base font-semibold text-ink">
                    <span aria-hidden className="mr-1.5">{s.emoji}</span>
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-mid">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── The example — for anyone who wants to see it play out ── */}
        <section className="flex min-h-[80vh] flex-col items-center justify-center">
          <Reveal className="w-full">
            <p className="mb-3 eyebrow">Curious how it plays out? Watch 👇</p>
            <LandingDemo />
          </Reveal>
        </section>

        {/* ── Beat 5 · the closing breath ── */}
        <section className="flex min-h-[70vh] flex-col items-center justify-center pb-16">
          <Reveal>
            <p className="text-base text-ink-soft">Before we decide…</p>
            <p className="mb-8 mt-1 font-serif text-3xl italic text-bloom">Let’s ThinkThru.</p>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-ink-mid">
              Every important decision begins with a conversation. Because no one sees the whole
              picture alone. <span className="text-ink">Together… we do.</span>
            </p>
            <a href="#start" className="btn-primary mt-8 inline-flex">
              🌱 Get started
            </a>
          </Reveal>
        </section>
      </div>
    </main>
  );
}
