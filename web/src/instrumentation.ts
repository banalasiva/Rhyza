// Next.js instrumentation hook — loads the right Sentry server config per
// runtime. The configs no-op when no DSN is set, so this is inert until Sentry
// is configured. Also exports onRequestError so App Router server errors (the
// 500-class failures) are reported.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
