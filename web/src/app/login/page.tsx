import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";
import { AuthPanel } from "@/components/AuthPanel";
import { ScrollCue } from "@/components/ScrollCue";

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
