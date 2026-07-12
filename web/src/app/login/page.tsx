import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { ScrollCue } from "@/components/ScrollCue";
import { authErrorMessage } from "@/lib/services/auth-events";

const BEATS = [
  { emoji: "💬", title: "Discuss", body: "Bring a real decision and talk it through — many minds, every angle, Claude alongside." },
  { emoji: "⚖️", title: "Decide", body: "Weigh what matters and whose stake runs deepest — the Quorum turns it into one fair call." },
  { emoji: "🌸", title: "Bloom", body: "It settles into one answer your community keeps forever." },
];

// Real decisions people wrestle with — the kind that get lost in a group chat.
// Shown right up front so a first-time visitor instantly sees "this is for me."
const EXAMPLES = [
  "🏫 Which school for our kid?",
  "🏡 Where should we live?",
  "💼 Take the new job?",
  "👵🏽 Caring for aging parents",
  "💰 How do we save more?",
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
    <main id="main" className="relative flex min-h-screen items-center justify-center px-6 py-10">
      <div className="garden-bg" />
      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
        {/* ── Live demo: a real question that Blooms ── */}
        <div className="order-first lg:order-last">
          <LandingDemo />
        </div>

        {/* ── Story + sign in ── */}
        <div className="text-center lg:text-left">
          <Image
            src="/logo-source.png"
            alt="ThinkThru — Think together. Grow together."
            width={200}
            height={200}
            priority
            className="mx-auto mb-4 h-auto w-40 sm:w-48 lg:mx-0"
          />
          <p className="eyebrow mb-2">Why ThinkThru?</p>
          <h1 className="serif-xl mb-3">
            The big decisions deserve better than a group chat.
          </h1>
          <p className="mb-4 text-lg text-ink-mid">
            Which school for our child? Do we take the offer? How do we care for
            aging parents? ThinkThru turns the messy back-and-forth into one clear,
            fair decision your people stand behind — and{" "}
            <span className="font-serif italic text-bloom">keep forever</span>.
          </p>

          {/* Real decisions — so a first-timer instantly sees "this is for me." */}
          <div className="mb-6 flex flex-wrap justify-center gap-2 lg:justify-start">
            {EXAMPLES.map((e) => (
              <span
                key={e}
                className="rounded-full border border-[rgba(76,175,80,0.25)] bg-[rgba(76,175,80,0.06)] px-3 py-1 text-xs text-ink-mid"
              >
                {e}
              </span>
            ))}
          </div>

          <p className="eyebrow mb-2">How it works</p>
          <ol className="mx-auto mb-8 max-w-sm space-y-3 lg:mx-0">
            {BEATS.map((b) => (
              <li key={b.title} className="flex items-start gap-3 text-left">
                <span className="text-xl">{b.emoji}</span>
                <span>
                  <span className="font-medium text-ink">{b.title}</span>
                  <span className="block text-sm text-ink-soft">{b.body}</span>
                </span>
              </li>
            ))}
          </ol>

          {errorCode && (
            <AuthErrorBanner code={errorCode} message={authErrorMessage(errorCode)} />
          )}

          <AuthPanel
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
      </div>
      {/* Mobile-only "scroll for the sign-in below" hint. */}
      <ScrollCue />
    </main>
  );
}
