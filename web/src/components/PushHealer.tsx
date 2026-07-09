"use client";

import { useEffect } from "react";
import { healPush } from "@/lib/push-client";

// Silently refresh a possibly-stale push subscription with the server's current
// VAPID key, once per session. Many people subscribed under an older key (or the
// browser quietly dropped the subscription) — those devices look "on" but never
// receive anything until they re-subscribe. healPush() re-subscribes fresh and
// re-registers with the server; running it on app load heals everyone without
// them having to open Settings and toggle. No-op unless notifications are
// already granted, so it never prompts.
export function PushHealer() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("tt-push-healed") === "1") return;
      sessionStorage.setItem("tt-push-healed", "1");
    } catch {
      /* private mode — just run it */
    }
    void healPush();
  }, []);
  return null;
}
