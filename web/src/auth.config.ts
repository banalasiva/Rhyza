import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// ── Provider assembly ──────────────────────────────────────────
// Google is always available (personal sign-in). The enterprise SSO
// provider is a generic OIDC client — it lights up only when the
// AUTH_SSO_* env vars are set, so it works with Okta, Azure AD / Entra,
// Google Workspace, Auth0, or any OIDC-compliant IdP without code changes.
// SAML-only IdPs are bridged to OIDC via SAML Jackson (see DEPLOY.md).

const providers: NextAuthConfig["providers"] = [
  // Always show Google's account chooser. Without prompt=select_account, Google
  // silently reuses whatever account is already signed in on the device — so
  // someone with several Gmail accounts (or on a shared phone) gets logged into
  // the wrong one with no way to pick. The chooser is essential for onboarding.
  Google({
    authorization: { params: { prompt: "select_account" } },
    // Link Google to a user that already exists for the same email — someone who
    // was invited/added by family (which creates a user row) or used an email
    // magic link before. Without this, Auth.js throws OAuthAccountNotLinked and
    // bounces them back to /login (looks like "Google sent me to email again").
    // Safe here because Google verifies email ownership, so the address on the
    // Google profile is guaranteed to belong to the person signing in.
    allowDangerousEmailAccountLinking: true,
  }),
];

if (process.env.AUTH_SSO_ISSUER && process.env.AUTH_SSO_CLIENT_ID) {
  providers.push({
    id: "sso",
    name: process.env.AUTH_SSO_NAME || "SSO",
    type: "oidc",
    issuer: process.env.AUTH_SSO_ISSUER,
    clientId: process.env.AUTH_SSO_CLIENT_ID,
    clientSecret: process.env.AUTH_SSO_CLIENT_SECRET,
    // Most enterprise IdPs require explicit scopes.
    authorization: { params: { scope: "openid profile email" } },
    // NB: deliberately NOT allowDangerousEmailAccountLinking here. A generic OIDC
    // IdP may let a user self-assert an unverified `email`, which with linking on
    // would silently merge into a victim's existing account (takeover). Linking
    // stays only on Google, which verifies email ownership.
  });
}

// Routes that don't require an authenticated session.
//   /privacy       — Google's Play reviewers and crawlers must reach the policy
//                    without an account, or the store listing is rejected.
//   /delete-account — Google Play's account-deletion policy requires a public
//                    URL, reachable without signing in, describing how to delete.
//   /.well-known   — Digital Asset Links (assetlinks.json) must be publicly
//                    fetchable so the Android TWA can verify it owns this domain.
//   /manifest.webmanifest, /sw.js — the PWA manifest and service worker must be
//                    fetchable without a session, or install/packaging tools
//                    (PWABuilder, Play's TWA) can't read them ("manifest not found").
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/health",
  "/invite",
  "/privacy",
  "/delete-account",
  "/guidelines",
  "/about",
  "/.well-known",
  "/manifest.webmanifest",
  "/sw.js",
  // A person's profile is a shareable public page — anyone with the link can
  // view it (private sections are stripped server-side for non-owners).
  "/u/",
  // Calibration — a shared bloom link the decision's people open to say how it
  // landed. The page is viewable without an account (a token unlocks just that
  // one bloom); submitting still requires sign-in (enforced in the API/page).
  "/calibrate/",
  "/api/calibrate/",
];

export const authConfig = {
  providers,
  // Route auth errors back to our own /login (as ?error=CODE) instead of the
  // bare Auth.js error page, so we can show a friendly banner and log the
  // failure for the admin panel.
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    // Edge-evaluated gate used by middleware.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
