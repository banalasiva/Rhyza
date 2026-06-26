import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const ssoEnabled = !!process.env.AUTH_SSO_ISSUER;
  const ssoName = process.env.AUTH_SSO_NAME || "SSO";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div className="garden-bg" />
      <div className="card relative z-10 w-full max-w-sm p-8 text-center">
        <div className="mb-1 text-3xl">🌱</div>
        <h1 className="serif-xl mb-2">Rhyza</h1>
        <p className="mb-7 text-sm text-ink-mid">
          A botanical garden where ideas grow into collective knowledge.
        </p>

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

        <p className="mt-7 text-xs text-ink-soft">
          By continuing you agree to the Code of Conduct.
        </p>
      </div>
    </main>
  );
}
