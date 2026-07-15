import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

// The commit this bundle was built from — baked into the client so the app can
// tell when a newer version has been deployed and reload itself.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  // Enables src/instrumentation.ts (where Sentry's server/edge init lives) on
  // Next 14. Harmless if Sentry isn't configured — the init just no-ops.
  experimental: {
    instrumentationHook: true,
  },
};

// Wrap with Sentry. This is safe to always apply: without SENTRY_DSN the runtime
// init no-ops, and source-map upload only runs when SENTRY_AUTH_TOKEN is set
// (CI/prod), so local/dev builds are unaffected.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  // Don't fail the build if Sentry's plugin has an issue (e.g. no auth token).
  widenClientFileUpload: false,
});
