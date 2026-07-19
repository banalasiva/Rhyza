import { requireViewer } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { PasskeySetup } from "@/components/PasskeySetup";

export const metadata = { title: "Sign-in & security · ThinkThru" };

export default async function AccountPage() {
  const viewer = await requireViewer();
  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="serif-xl mb-1">Sign-in &amp; security</h1>
        <p className="mb-6 text-sm text-ink-soft">
          How you get into ThinkThru. Signed in as{" "}
          <span className="text-ink-mid">{viewer.email}</span>.
        </p>

        <section className="card p-5">
          <p className="eyebrow mb-1">🔑 Passkeys</p>
          <p className="mb-4 text-sm text-ink-soft">
            The simplest, safest way back in — sign in with Face ID, your fingerprint, or your
            device unlock. No password, no SMS code. Add one on each device you use; if your
            passkeys sync (iCloud Keychain, Google Password Manager) it&apos;ll follow you.
          </p>
          <PasskeySetup />
        </section>
      </main>
    </div>
  );
}
