import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Server-side Firebase Admin — used only to VERIFY the ID token the client gets
// after a successful phone sign-in. Node-only (imported from auth.ts, never the
// edge middleware). Gated on the service-account env so phone sign-in is simply
// absent until Firebase is configured — no KYC, unlike an SMS gateway.
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

let cached: App | undefined;
function adminApp(): App {
  if (!cached) {
    cached =
      getApps()[0] ??
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return cached;
}

// Verify a Firebase ID token from a client phone sign-in and return the verified
// E.164 phone number, or null if the token is invalid / carries no phone. Only a
// token Google actually signed passes — the client can't forge a phone number.
export async function verifyFirebasePhone(idToken: string): Promise<string | null> {
  if (!firebaseAdminConfigured() || !idToken) return null;
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken);
    return decoded.phone_number ?? null;
  } catch (err) {
    console.error("firebase verifyIdToken failed", err);
    return null;
  }
}
