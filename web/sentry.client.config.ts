import * as Sentry from "@sentry/nextjs";

// Client-side error + performance monitoring. Entirely gated on the DSN: with no
// NEXT_PUBLIC_SENTRY_DSN, Sentry.init is never called, so this is inert until you
// add a Sentry project. Inputs are masked in replays — we never record what
// people type.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    // Sample 10% of transactions for performance; capture all errors.
    tracesSampleRate: 0.1,
    // No Sentry session replay — PostHog already handles replay, and Sentry's
    // replay integration is the heaviest part of its client bundle. Keeping
    // Sentry to errors + tracing keeps the shared JS lean.
  });
}
