import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Client-side Firebase — runs the phone OTP flow (send code, confirm code) in
// the browser. The config values are public by design (NEXT_PUBLIC_*): Firebase
// security comes from the Authorized Domains list + reCAPTCHA, not from hiding
// the API key. The resulting ID token is verified server-side (firebase-admin).
//
// Required env (Firebase console → Project settings → your web app config):
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_APP_ID        (optional)

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseClientConfigured(): boolean {
  return !!(config.apiKey && config.authDomain && config.projectId);
}

// Lazily create (or reuse) the Firebase app and return its Auth instance.
export function getFirebaseAuth(): Auth {
  const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}
