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

        {/* ── One line: what it is ── */}
        <h1 className="serif-xl mb-3">Decide the big things, together.</h1>
        <p className="mb-6 text-lg text-ink-mid">
          Talk it through with your people, ask AI along the way, and land on one answer you keep.
        </p>

        {/* ── The story does the explaining ── */}
        <LandingDemo />

        {/* ── Then: just sign up ── */}
        <div className="mt-8 rounded-2xl border border-[rgba(76,175,80,0.4)] bg-[rgba(76,175,80,0.06)] p-5 shadow-[0_0_30px_rgba(76,175,80,0.12)]">
          <p className="mb-1 serif-lg">Start free — it takes 10 seconds</p>
          <p className="mb-4 text-xs text-ink-soft">Bring your people in and make your first decision.</p>
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
      </div>

      {/* Mobile-only "scroll for more" hint. */}
      <ScrollCue />
    </main>
  );
}
