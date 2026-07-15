"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
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
  phoneEnabled = false,
  googleAction,
  emailAction,
  ssoAction,
  defaultMode = "signin",
}: {
  emailEnabled: boolean;
  ssoEnabled: boolean;
  ssoName: string;
  phoneEnabled?: boolean;
  googleAction: () => Promise<void>;
  emailAction: (formData: FormData) => Promise<void>;
  ssoAction: () => Promise<void>;
  defaultMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const signup = mode === "signup";

  // Phone (Telegram-style: number → SMS code → in) via Firebase Phone Auth. The
  // OTP send + confirm run in the browser through the Firebase SDK; we then hand
  // the resulting ID token to NextAuth to mint our own session. Two steps so a
  // wrong code shows inline instead of bouncing to an error page.
  const [phoneStep, setPhoneStep] = useState<"enter" | "code">("enter");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // Firebase's invisible reCAPTCHA verifier + the pending confirmation handle.
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  function recaptcha(): RecaptchaVerifier {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(getFirebaseAuth(), "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaRef.current;
  }

  async function sendCode() {
    if (phoneBusy) return;
    const e164 = "+" + phone.replace(/\D/g, "");
    if (e164.length < 9) {
      setPhoneError("Enter your number with country code, e.g. +91…");
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      confirmationRef.current = await signInWithPhoneNumber(getFirebaseAuth(), e164, recaptcha());
      setPhoneStep("code");
    } catch (err) {
      const c = (err as { code?: string })?.code ?? "";
      setPhoneError(
        c.includes("invalid-phone")
          ? "That doesn't look like a valid number — include your country code."
          : c.includes("too-many-requests") || c.includes("quota")
            ? "Too many attempts (or daily limit hit). Wait a bit and try again."
            : c.includes("operation-not-allowed") || c.includes("admin-restricted")
              ? "Phone sign-in isn’t enabled in Firebase yet."
              : c.includes("billing")
                ? "Firebase needs the Blaze (pay-as-you-go) plan for phone sign-in."
                : c.includes("captcha") || c.includes("invalid-app-credential")
                  ? "This domain isn’t authorized in Firebase (add thinkthru.app)."
                  : `Couldn't send the code (${c || "unknown error"}).`,
      );
      // A failed attempt burns the reCAPTCHA token; reset so a retry re-solves.
      try {
        recaptchaRef.current?.clear();
      } catch {
        /* ignore */
      }
      recaptchaRef.current = null;
    } finally {
      setPhoneBusy(false);
    }
  }

  async function verifyCode() {
    if (phoneBusy || !confirmationRef.current) return;
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const cred = await confirmationRef.current.confirm(code);
      const idToken = await cred.user.getIdToken();
      const res = await signIn("phone", { idToken, redirect: false });
      if (res?.error) setPhoneError("Couldn't sign you in. Try again.");
      else window.location.href = "/";
    } catch {
      setPhoneError("That code didn’t match. Check it and try again.");
    } finally {
      setPhoneBusy(false);
    }
  }

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

      {phoneEnabled && (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] text-ink-soft">
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
            or with your phone
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
          </div>
          {phoneStep === "enter" ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2.5 text-base text-ink outline-none focus:border-accent"
              />
              <button type="submit" disabled={phoneBusy} className="btn-ghost w-full disabled:opacity-60">
                {phoneBusy ? "Sending…" : "Text me a code"}
              </button>
              <p className="text-[11px] text-ink-soft">
                Include your country code. Standard message rates may apply.
              </p>
            </form>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void verifyCode();
              }}
            >
              <p className="text-[11px] text-ink-soft">
                Code sent by text to <span className="text-ink-mid">{phone}</span> ·{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep("enter");
                    setCode("");
                    setPhoneError(null);
                  }}
                  className="font-medium text-accent"
                >
                  change
                </button>
              </p>
              <input
                name="code"
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2.5 text-center text-lg tracking-[0.3em] text-ink outline-none focus:border-accent"
              />
              <button type="submit" disabled={phoneBusy} className="btn-ghost w-full disabled:opacity-60">
                {phoneBusy ? "Verifying…" : "Verify & continue"}
              </button>
              <button
                type="button"
                disabled={phoneBusy}
                onClick={() => {
                  setPhoneStep("enter");
                  setCode("");
                  setPhoneError(null);
                }}
                className="w-full text-center text-[11px] text-ink-soft hover:text-ink disabled:opacity-60"
              >
                Didn’t get it? Start over
              </button>
            </form>
          )}
          {phoneError && <p className="mt-2 text-[11px] text-red-400">{phoneError}</p>}
          {/* Firebase renders its invisible reCAPTCHA challenge into this node. */}
          <div id="recaptcha-container" />
        </>
      )}

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
