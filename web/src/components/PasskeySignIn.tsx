"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { apiPost } from "@/lib/client";

// "Sign in with a passkey" — Face ID / fingerprint / device unlock. No SMS, no
// codes, no vendor. Usernameless: the platform offers whichever ThinkThru
// passkey lives on this device, so there's nothing to type. Only shown where
// WebAuthn exists; on a device with no passkey the platform just says so.
export function PasskeySignIn({ next = "/" }: { next?: string }) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
  }, []);

  if (!supported) return null;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      // 1) Ask the server for a login challenge.
      const { options, challengeId } = await apiPost<{ options: unknown; challengeId: string }>(
        "/api/passkeys/auth/options",
        {},
      );
      // 2) Let the authenticator sign it (Face ID / fingerprint / PIN).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await startAuthentication(options as any);
      // 3) Hand the assertion to Auth.js — a success mints a normal session.
      const res = await signIn("passkey", {
        challengeId,
        response: JSON.stringify(response),
        redirect: false,
      });
      if (res?.error) {
        setError("That passkey didn't match. Try another way in.");
      } else {
        window.location.href = next;
      }
    } catch (err) {
      // A user cancelling the OS sheet throws — treat as a quiet no-op.
      const name = (err as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError("Couldn't use a passkey on this device.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="btn-ghost flex w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
      >
        <span aria-hidden>🔑</span>
        {busy ? "Waiting for your passkey…" : "Sign in with a passkey"}
      </button>
      {error && <p className="mt-1.5 text-center text-xs text-[#e57373]">{error}</p>}
    </div>
  );
}
