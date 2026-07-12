import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { LandingDemo } from "@/components/LandingDemo";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { ScrollCue } from "@/components/ScrollCue";
import { authErrorMessage } from "@/lib/services/auth-events";

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

      {/* One clean column: a line, the story, then sign up. */}
      <div className="relative z-10 w-full max-w-md text-center">
        <Image
          src="/logo-source.png"
          alt="ThinkThru — Think together. Grow together."
          width={200}
          height={200}
          priority
          className="mx-auto mb-4 h-auto w-32 sm:w-40"
        />

        {/* ── The hero — let the feeling do the selling ── */}
        <h1 className="serif-xl mb-4">What should we do?</h1>
        <p className="text-lg text-ink-mid">
          Life’s biggest decisions rarely have one right answer.
        </p>
        <p className="mt-3 text-base text-ink-soft">Before we decide…</p>
        <p className="mt-1 font-serif text-2xl italic text-bloom">Let’s ThinkThru.</p>

        {/* ── Start free — the hero action, right here ── */}
        <div className="mt-7 rounded-2xl border border-[rgba(76,175,80,0.4)] bg-[rgba(76,175,80,0.06)] p-5 shadow-[0_0_30px_rgba(76,175,80,0.12)]">
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
          <p className="mt-3 text-[11px] text-ink-soft">Free · takes 10 seconds</p>
        </div>

        {/* ── The story, for anyone who wants to see how it works ── */}
        <p className="mb-3 mt-10 eyebrow">See it in action 👇</p>
        <LandingDemo />
      </div>

      {/* Mobile-only "scroll for more" hint. */}
      <ScrollCue />
    </main>
  );
}
