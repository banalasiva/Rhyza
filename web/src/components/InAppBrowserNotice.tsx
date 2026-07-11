"use client";

import { useEffect, useState } from "react";

// New people usually arrive by tapping a link shared in WhatsApp / Instagram /
// Facebook — which opens inside that app's EMBEDDED browser. Google explicitly
// blocks OAuth in embedded webviews ("this browser may not be secure"), and the
// result is a broken, confusing sign-in. So when we detect an in-app browser, we
// tell the person to reopen ThinkThru in Chrome/Safari (where Google works), and
// point them at email sign-in as the webview-friendly alternative.
function detectInApp(ua: string): boolean {
  return (
    /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|MicroMessenger|GSA\//i.test(ua) ||
    // Android System WebView marker — WhatsApp's in-app browser lands here.
    /; wv\)/i.test(ua)
  );
}

export function InAppBrowserNotice({ emailEnabled }: { emailEnabled: boolean }) {
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") setInApp(detectInApp(navigator.userAgent));
  }, []);

  if (!inApp) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText("https://thinkthru.app/login");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the instructions still apply */
    }
  }

  return (
    <div className="mb-5 rounded-2xl border border-[rgba(255,179,0,0.4)] bg-[rgba(255,179,0,0.08)] p-4 text-left">
      <p className="text-sm font-semibold text-ink">Open in your browser to sign in with Google</p>
      <p className="mt-1 text-xs text-ink-mid">
        You&apos;re in an in-app browser (WhatsApp / Instagram), and Google blocks sign-in here. Tap
        the <span className="text-ink">⋮</span> or <span className="text-ink">Share</span> menu
        (top corner) → <span className="text-ink">Open in Chrome</span> / Safari, then continue with
        Google.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={copyLink} className="btn-primary px-3 py-1.5 text-xs">
          {copied ? "Link copied ✓" : "Copy the link"}
        </button>
        {emailEnabled && (
          <span className="text-xs text-ink-soft">…or use email sign-in below — it works here.</span>
        )}
      </div>
    </div>
  );
}
