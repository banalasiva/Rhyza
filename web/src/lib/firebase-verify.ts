import { jwtVerify, createRemoteJWKSet } from "jose";

// Verify Firebase ID tokens WITHOUT the firebase-admin SDK. A Firebase ID token
// is a standard RS256 JWT signed by Google; verifying it needs only Google's
// public keys + the project id — NOT the service-account private key (that's
// only for MINTING tokens, which we never do). This keeps the server light,
// reuses `jose` (already pulled in by Auth.js), and sidesteps firebase-admin's
// native/ESM bundling problems that were 500ing the app.
//
// Config: just the project id — reused from the public client config, so phone
// sign-in needs NO extra server secret. FIREBASE_PROJECT_ID can override it.

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

export function firebaseVerifyConfigured(): boolean {
  return !!projectId;
}

// Google serves Firebase's secure-token public keys as a JWK Set here; jose
// fetches + caches them, refreshing per the endpoint's cache headers.
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

// Verify a client's Firebase ID token and return the verified E.164 phone
// number, or null if the token is invalid / not for this project / has no phone.
// jose checks the signature, expiry, issuer and audience — the client can't
// forge any of it.
export async function verifyFirebasePhone(idToken: string): Promise<string | null> {
  if (!projectId || !idToken) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const phone = (payload as Record<string, unknown>).phone_number;
    return typeof phone === "string" ? phone : null;
  } catch (err) {
    console.error("firebase token verify failed", err);
    return null;
  }
}

// Health check for /api/admin/firebase-check: confirms the project id is set and
// the server can actually reach Google's public keys (so a real verify will
// work). No secrets involved.
export async function firebaseVerifySelfTest(): Promise<{ ok: boolean; error?: string }> {
  if (!projectId)
    return { ok: false, error: "Project id not set (need NEXT_PUBLIC_FIREBASE_PROJECT_ID)." };
  try {
    const res = await fetch(JWKS_URL, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Couldn't fetch Google public keys (HTTP ${res.status}).` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
