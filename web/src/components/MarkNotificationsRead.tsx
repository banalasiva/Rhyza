"use client";

import { useEffect } from "react";

// Fires the "mark all read" write AFTER the Notifications page has painted, so
// clearing the bell badge never gates the server render (which it used to, as a
// blocking updateMany). Renders nothing.
export function MarkNotificationsRead() {
  useEffect(() => {
    // Best-effort — if it fails, the badge just clears on the next visit.
    fetch("/api/notifications", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
