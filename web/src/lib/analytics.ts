import type { PostHog } from "posthog-js";

// Thin analytics wrapper. posthog-js is NOT imported here (only its type, which
// is erased at build) — the Analytics component lazy-loads the library and hands
// the instance to _setPostHog() only when a key is configured. So when analytics
// is unconfigured, posthog-js never enters the bundle, and every call below is a
// no-op. Client-only. Instrumentation must never break the app or throw.

let ph: PostHog | null = null;

// Called by the Analytics component after it lazy-inits PostHog.
export function _setPostHog(instance: PostHog) {
  ph = instance;
}

// Record a product event, e.g. track("seed_planted", { visibility }).
export function track(event: string, props?: Record<string, unknown>) {
  try {
    ph?.capture(event, props);
  } catch {
    /* never let analytics throw */
  }
}

// Tie the anonymous session to a signed-in person (retention cohorts / funnels).
export function identify(id: string, props?: Record<string, unknown>) {
  try {
    ph?.identify(id, props);
  } catch {
    /* ignore */
  }
}

// Clear identity on sign-out so a shared device doesn't cross-attribute.
export function resetAnalytics() {
  try {
    ph?.reset();
  } catch {
    /* ignore */
  }
}
