import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";

const BEATS = [
  { emoji: "💬", title: "Discuss", body: "Bring a real decision and talk it through — many minds, every angle, Claude alongside." },
  { emoji: "⚖️", title: "Decide", body: "Weigh what matters and whose stake runs deepest — the Quorum turns it into one fair call." },
  { emoji: "🌸", title: "Bloom", body: "It settles into one answer your community keeps forever." },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const ssoEnabled = !!process.env.AUTH_SSO_ISSUER;
  const ssoName = process.env.AUTH_SSO_NAME || "SSO";
  const emailEnabled = !!process.env.RESEND_API_KEY;

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
          <h1 className="serif-xl mb-3">
            Every important decision begins with a conversation.
          </h1>
          <p className="mb-8 text-lg text-ink-mid">
            Together, we help conversations{" "}
            <span className="font-serif italic text-bloom">Bloom</span>.
          </p>

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

          <div className="mx-auto max-w-sm lg:mx-0">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button type="submit" className="btn-primary w-full">
                Continue with Google
              </button>
            </form>

            {ssoEnabled && (
              <form
                className="mt-3"
                action={async () => {
                  "use server";
                  await signIn("sso", { redirectTo: "/" });
                }}
              >
                <button type="submit" className="btn-ghost w-full">
                  Continue with {ssoName}
                </button>
              </form>
            )}

            {emailEnabled && (
              <>
                <div className="my-4 flex items-center gap-3 text-[11px] text-ink-soft">
                  <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
                  or use your email
                  <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
                </div>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const email = String(formData.get("email") || "").trim();
                    if (!email) return;
                    await signIn("resend", { email, redirectTo: "/" });
                  }}
                  className="space-y-2"
                >
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                  <button type="submit" className="btn-ghost w-full">
                    Email me a sign-in link
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-ink-soft">
                  No password — we’ll send a one-tap link to your inbox.
                </p>
              </>
            )}

            <p className="mt-5 text-xs text-ink-soft">
              By continuing you agree to the Code of Conduct.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
