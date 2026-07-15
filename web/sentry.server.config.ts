import * as Sentry from "@sentry/nextjs";

// Server-side (Node runtime) error + performance monitoring — catches API-route
// exceptions and the kind of 500 that took the app down before. Gated on the
// DSN, so inert until configured.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
