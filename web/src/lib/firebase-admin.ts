import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

// Server-side Firebase Admin — used only to VERIFY the ID token the client gets
// after a successful phone sign-in. Node-only (imported from auth.ts, never the
// edge middleware). Gated on the service-account env so phone sign-in is simply
// absent until Firebase is configured — no KYC, unlike an SMS gateway.
//
// IMPORTANT: firebase-admin is loaded LAZILY (dynamic import inside the verify
// function), never at module top level. auth.ts imports this file, and auth() is
// called by nearly every server route/page — so if firebase-admin were in this
// module's static graph, any bundling/runtime issue with it would 500 the whole
// app. The type-only imports above are erased at compile time and load nothing.
//
// Required env (from a Firebase service-account JSON, Project settings →
// Service accounts → Generate new private key):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the whole key; \n escapes are handled below)

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Vercel stores multi-line secrets with literal "\n"; turn them back into real
// newlines so the PEM parses.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

export function firebaseAdminConfigured(): boolean {
  return !!(projectId && clientEmail && privateKey);
}

let cachedApp: App | undefined;
async function adminAuth(): Promise<Auth> {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  if (!cachedApp) {
    cachedApp =
      getApps()[0] ??
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getAuth(cachedApp);
}

// Health check for the /api/admin/firebase-check endpoint: proves the private
// key actually parses and signs, without any external input. createCustomToken
// signs locally with the service-account key, so a malformed key (stray quotes,
// mangled newlines) throws here with a descriptive — but non-secret — error.
export async function firebaseAdminSelfTest(): Promise<{ ok: boolean; error?: string }> {
  if (!firebaseAdminConfigured()) return { ok: false, error: "Admin env not fully set." };
  try {
    const auth = await adminAuth();
    await auth.createCustomToken("healthcheck");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Verify a Firebase ID token from a client phone sign-in and return the verified
// E.164 phone number, or null if the token is invalid / carries no phone. Only a
// token Google actually signed passes — the client can't forge a phone number.
export async function verifyFirebasePhone(idToken: string): Promise<string | null> {
  if (!firebaseAdminConfigured() || !idToken) return null;
  try {
    const auth = await adminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.phone_number ?? null;
  } catch (err) {
    console.error("firebase verifyIdToken failed", err);
    return null;
  }
}
