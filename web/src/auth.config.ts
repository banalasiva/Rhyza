import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// ── Provider assembly ──────────────────────────────────────────
// Google is always available (personal sign-in). The enterprise SSO
// provider is a generic OIDC client — it lights up only when the
// AUTH_SSO_* env vars are set, so it works with Okta, Azure AD / Entra,
// Google Workspace, Auth0, or any OIDC-compliant IdP without code changes.
// SAML-only IdPs are bridged to OIDC via SAML Jackson (see DEPLOY.md).

const providers: NextAuthConfig["providers"] = [Google];

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
    allowDangerousEmailAccountLinking: true,
  });
}

// Routes that don't require an authenticated session.
//   /privacy       — Google's Play reviewers and crawlers must reach the policy
//                    without an account, or the store listing is rejected.
//   /.well-known   — Digital Asset Links (assetlinks.json) must be publicly
//                    fetchable so the Android TWA can verify it owns this domain.
//   /manifest.webmanifest, /sw.js — the PWA manifest and service worker must be
//                    fetchable without a session, or install/packaging tools
//                    (PWABuilder, Play's TWA) can't read them ("manifest not found").
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/invite",
  "/privacy",
  "/.well-known",
  "/manifest.webmanifest",
  "/sw.js",
];

export const authConfig = {
  providers,
  pages: { signIn: "/login", verifyRequest: "/login/check-email" },
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
