"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { PostHog } from "posthog-js";
import { _setPostHog, identify } from "@/lib/analytics";

// PostHog product analytics — pageviews, the cold-start funnel, session replay.
// Gated on NEXT_PUBLIC_POSTHOG_KEY AND lazy-loaded: with no key, posthog-js is
// never imported, so it adds nothing to the bundle. With a key, it loads as a
// separate async chunk after mount (non-blocking). Mounted once in the layout.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Module-level handle so the pageview effect can reach the loaded instance.
let ph: PostHog | null = null;

export function Analytics() {
  // Lazy-init once on first mount.
  useEffect(() => {
    if (!KEY || typeof window === "undefined" || ph) return;
    let cancelled = false;
    import("posthog-js")
      .then(({ default: posthog }) => {
        if (cancelled) return;
        posthog.init(KEY, {
          api_host: HOST,
          capture_pageview: false, // captured manually on route change (App Router)
          capture_pageleave: true,
          persistence: "localStorage+cookie",
          session_recording: { maskAllInputs: true }, // never record what people type
          respect_dnt: true,
        });
        ph = posthog;
        _setPostHog(posthog);
        // Identify the signed-in user (anonymous otherwise). 401 when logged out.
        fetch("/api/users/me")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const u = d?.user;
            if (u?.id) identify(u.id, u.email ? { email: u.email } : undefined);
          })
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // App Router doesn't fire pageviews automatically — capture on path change.
  const pathname = usePathname();
  useEffect(() => {
    if (ph) ph.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return null;
}
