import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";

const BEATS = [
  { emoji: "🌱", title: "Plant a question", body: "A real decision worth thinking through." },
  { emoji: "🌿", title: "Grow it together", body: "Many minds, every angle — Claude alongside you." },
  { emoji: "🌸", title: "Watch it Bloom", body: "Into one answer your community keeps forever." },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const ssoEnabled = !!process.env.AUTH_SSO_ISSUER;
  const ssoName = process.env.AUTH_SSO_NAME || "SSO";

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
          <p className="eyebrow mb-4">🌱 Rhyza</p>
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

            <p className="mt-5 text-xs text-ink-soft">
              By continuing you agree to the Code of Conduct.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
