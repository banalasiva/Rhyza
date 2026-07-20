import { cookies } from "next/headers";
import { requireViewer } from "@/lib/session";
import { signIn } from "@/auth";
import { isGuestEmail } from "@/lib/guest";
import { NavBar } from "@/components/NavBar";
import { PasskeySetup } from "@/components/PasskeySetup";

export const metadata = { title: "Sign-in & security · ThinkThru" };

const MERGE_COOKIE = "tt-merge-from";

export default async function AccountPage() {
  const viewer = await requireViewer();
  const isGuest = isGuestEmail(viewer.email);
  const emailEnabled = !!process.env.RESEND_API_KEY;

  const guestId = viewer.userId;
  // Cookie options: sameSite:lax lets it survive the OAuth round-trip back to us.
  const mergeCookie = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 3600 };

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="serif-xl mb-1">Sign-in &amp; security</h1>
        <p className="mb-6 text-sm text-ink-soft">
          {isGuest ? (
            <>You&apos;re here as a guest ({viewer.name || "no name yet"}). Save your account to keep it.</>
          ) : (
            <>
              How you get into ThinkThru. Signed in as{" "}
              <span className="text-ink-mid">{viewer.email}</span>.
            </>
          )}
        </p>

        {isGuest ? (
          <section className="card border-[rgba(76,175,80,0.35)] p-5">
            <p className="eyebrow mb-1">🌱 Save your account</p>
            <p className="mb-4 text-sm text-ink-soft">
              You joined as a guest — everything you&apos;ve said stays yours. Save your account and
              your name, posts and threads all come with you, plus you can ask Claude &amp; ChatGPT
              and start your own seeds. Nothing is lost.
            </p>

            <form
              action={async () => {
                "use server";
                cookies().set(MERGE_COOKIE, guestId, mergeCookie);
                await signIn("google", { redirectTo: "/account/claim?next=/" });
              }}
            >
              <button type="submit" className="btn-primary w-full">
                Continue with Google
              </button>
            </form>

            {emailEnabled && (
              <>
                <div className="my-3 flex items-center gap-3 text-[11px] text-ink-soft">
                  <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
                  or use your email
                  <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
                </div>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const email = String(formData.get("email") || "").trim();
                    if (!email) return;
                    cookies().set(MERGE_COOKIE, guestId, mergeCookie);
                    await signIn("resend", { email, redirectTo: "/account/claim?next=/" });
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
              </>
            )}
            <p className="mt-3 text-[11px] text-ink-soft">
              Saving keeps the same you — same name, same posts, same threads.
            </p>
          </section>
        ) : (
          <section className="card p-5">
            <p className="eyebrow mb-1">🔑 Passkeys</p>
            <p className="mb-4 text-sm text-ink-soft">
              The simplest, safest way back in — sign in with Face ID, your fingerprint, or your
              device unlock. No password, no SMS code. Add one on each device you use; if your
              passkeys sync (iCloud Keychain, Google Password Manager) it&apos;ll follow you.
            </p>
            <PasskeySetup />
          </section>
        )}
      </main>
    </div>
  );
}
