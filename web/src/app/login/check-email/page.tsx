import Image from "next/image";
import Link from "next/link";

// Where Auth.js sends people after they request a passwordless sign-in link.
// Branded to match the rest of ThinkThru instead of the library's plain default.
export default function CheckEmailPage() {
  return (
    <main id="main" className="relative flex min-h-screen items-center justify-center px-6">
      <div className="garden-bg" />
      <div className="card relative z-10 w-full max-w-sm p-8 text-center">
        <Image
          src="/emblem.png"
          alt=""
          width={48}
          height={48}
          priority
          className="mx-auto mb-3 h-12 w-12"
        />
        <p className="eyebrow mb-2">📬 Check your email</p>
        <h1 className="serif-lg mb-2">Your sign-in link is on its way</h1>
        <p className="mb-6 text-sm text-ink-mid">
          We sent a one-tap link to your inbox. Open it on this device to sign in — no password
          needed. It works once and expires soon.
        </p>
        <p className="mb-6 text-xs text-ink-soft">
          Didn’t get it within a minute? Check spam, or head back and try again.
        </p>
        <Link href="/login" className="btn-ghost w-full">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
