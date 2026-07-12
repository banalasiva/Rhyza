import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { ScrollCue } from "@/components/ScrollCue";
import { authErrorMessage } from "@/lib/services/auth-events";

const BEATS = [
  { emoji: "💬", title: "Discuss", body: "Talk it through — with Claude in the room." },
  { emoji: "⚖️", title: "Decide", body: "Weigh what matters, fairly." },
  { emoji: "🌸", title: "Bloom", body: "One answer you all keep." },
];

// Real decisions people wrestle with — the kind that get lost in a group chat.
// Shown right up front so a first-time visitor instantly sees "this is for me."
const EXAMPLES = [
  "✈️ Where should we holiday?",
  "🏫 Which school for our kid?",
  "🏡 Where should we live?",
  "💼 Take the new job?",
  "👵🏽 Caring for aging parents",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const ssoEnabled = !!process.env.AUTH_SSO_ISSUER;
  const ssoName = process.env.AUTH_SSO_NAME || "SSO";
  const emailEnabled = !!process.env.RESEND_API_KEY;
  const errorCode = searchParams?.error;

  return (
    <main id="main" className="relative flex min-h-screen flex-col items-center px-6 py-10">
      <div className="garden-bg" />

      {/* One clean column: read → get sold → sign up (the hero). */}
      <div className="relative z-10 w-full max-w-md text-center">
        <Image
          src="/logo-source.png"
          alt="ThinkThru — Think together. Grow together."
          width={200}
          height={200}
          priority
          className="mx-auto mb-4 h-auto w-32 sm:w-40"
        />

        {/* ── Why (simple, one breath) ── */}
        <h1 className="serif-xl mb-3">Decide the big things, together.</h1>
        <p className="mb-4 text-lg text-ink-mid">
          Family and friends thinking real decisions through — with AI right in the room.
        </p>

        {/* Real decisions — so a first-timer instantly sees "this is for me." */}
        <div className="mb-6 flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((e) => (
            <span
              key={e}
              className="rounded-full border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-2.5 py-1 text-[11px] text-ink-mid"
            >
              {e}
            </span>
          ))}
        </div>

        {/* ── The one difference people ask about ── */}
        <div className="mb-6 rounded-2xl border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.05)] p-4 text-left">
          <p className="mb-1 text-sm font-medium text-ink">“Isn’t this just ChatGPT?”</p>
          <p className="text-sm text-ink-mid">
            Not quite. Here it’s your <span className="text-ink">people and AI, together</span> —
            your whole circle decides, every voice weighed, Claude thinking alongside you. Not one
            person and a bot.
          </p>
        </div>

        {/* ── How, in three words ── */}
        <div className="mb-7 flex items-stretch justify-center gap-2">
          {BEATS.map((b) => (
            <div
              key={b.title}
              className="flex-1 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(7,13,7,0.4)] p-3"
            >
              <div className="text-xl">{b.emoji}</div>
              <p className="mt-1 text-sm font-semibold text-ink">{b.title}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{b.body}</p>
            </div>
          ))}
        </div>

        {/* ── Sign up — the hero ── */}
        <div className="rounded-2xl border border-[rgba(76,175,80,0.4)] bg-[rgba(76,175,80,0.06)] p-5 shadow-[0_0_30px_rgba(76,175,80,0.12)]">
          <p className="mb-1 serif-lg">Start free — it takes 10 seconds</p>
          <p className="mb-4 text-xs text-ink-soft">Your first decision is waiting. Bring your people in.</p>
          {errorCode && (
            <AuthErrorBanner code={errorCode} message={authErrorMessage(errorCode)} />
          )}
          <AuthPanel
            defaultMode="signup"
            emailEnabled={emailEnabled}
            ssoEnabled={ssoEnabled}
            ssoName={ssoName}
            googleAction={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
            emailAction={async (formData: FormData) => {
              "use server";
              const email = String(formData.get("email") || "").trim();
              if (!email) return;
              await signIn("resend", { email, redirectTo: "/" });
            }}
            ssoAction={async () => {
              "use server";
              await signIn("sso", { redirectTo: "/" });
            }}
          />
        </div>

        {/* ── Proof for the curious: a real decision blooming ── */}
        <p className="mb-3 mt-10 eyebrow">See a real decision bloom 👇</p>
        <LandingDemo />
      </div>

      {/* Mobile-only "scroll for more" hint. */}
      <ScrollCue />
    </main>
  );
}
