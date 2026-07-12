"use client";

import { useState } from "react";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";

// The sign-in / sign-up panel. Auth.js treats Google and the email magic-link
// the same for new vs returning people (both sign in an existing account OR
// create one), so the two tabs mainly reframe the copy — but that's what people
// expect, and it lets someone who doesn't do Google clearly "create an account"
// with their email. Google is the prominent, always-there option.
export function AuthPanel({
  emailEnabled,
  ssoEnabled,
  ssoName,
  googleAction,
  emailAction,
  ssoAction,
  defaultMode = "signin",
}: {
  emailEnabled: boolean;
  ssoEnabled: boolean;
  ssoName: string;
  googleAction: () => Promise<void>;
  emailAction: (formData: FormData) => Promise<void>;
  ssoAction: () => Promise<void>;
  defaultMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const signup = mode === "signup";

  return (
    <div className="mx-auto max-w-sm lg:mx-0">
      <InAppBrowserNotice emailEnabled={emailEnabled} />

      {/* Sign in / Sign up tabs */}
      <div className="mb-4 flex rounded-full border border-[rgba(255,255,255,0.12)] p-0.5 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex-1 rounded-full py-1.5 font-medium transition ${
              mode === m ? "bg-[rgba(76,175,80,0.18)] text-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {/* Google — the prominent, must-have option */}
      <form action={googleAction}>
        <button
          type="submit"
          className="btn-primary flex w-full items-center justify-center gap-2.5"
        >
          <GoogleG />
          {signup ? "Start free with Google" : "Continue with Google"}
        </button>
      </form>

      {emailEnabled && (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] text-ink-soft">
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
            or with email
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
          </div>
          <form action={emailAction} className="space-y-2">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              className="w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2.5 text-base text-ink outline-none focus:border-accent"
            />
            <button type="submit" className="btn-ghost w-full">
              {signup ? "Sign up with email" : "Email me a sign-in link"}
            </button>
          </form>
          <p className="mt-2 text-[11px] text-ink-soft">
            No password — a one-tap link lands in your inbox.
          </p>
        </>
      )}

      {ssoEnabled && (
        <form className="mt-3" action={ssoAction}>
          <button type="submit" className="btn-ghost w-full">
            Continue with {ssoName}
          </button>
        </form>
      )}

      {/* Cross-link between the two modes */}
      <p className="mt-4 text-center text-xs text-ink-soft lg:text-left">
        {signup ? (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("signin")} className="font-medium text-accent">
              Sign in
            </button>
          </>
        ) : (
          <>
            New to ThinkThru?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-medium text-accent">
              Create an account
            </button>
          </>
        )}
      </p>

      <p className="mt-4 text-xs text-ink-soft">By continuing you agree to the Code of Conduct.</p>
    </div>
  );
}

// The multi-colour Google "G" so the button reads as a real Google sign-in.
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.6 5.6C41.8 35.9 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
