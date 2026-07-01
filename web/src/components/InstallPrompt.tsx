"use client";

import { useEffect, useState } from "react";

// Turns a first open (often from a WhatsApp invite) into an *installed* app —
// which on iPhone is the only way that person can ever receive push. Two paths:
//   • Android/desktop Chrome: capture beforeinstallprompt and offer a real
//     "Add to Home Screen" button that triggers the native install.
//   • iOS Safari: there is no such event, so we show the manual steps (Share →
//     Add to Home Screen) — the only way to install on iPhone.
// Already-installed users (running standalone) never see it, and dismissing it
// snoozes it for a week so it never nags.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SNOOZE_KEY = "tt-install-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this instead of the display-mode media query.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as a Mac — detect the touch Mac case too.
  const iPadOSMac = /macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  return iDevice || iPadOSMac;
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || snoozed()) return;

    // Android / desktop: the browser fires this when the app is installable.
    function onBIP(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    }
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS never fires the event — show the manual steps after a gentle delay so
    // it doesn't slam the very first paint.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isIOS()) {
      t = setTimeout(() => {
        if (!isStandalone() && !snoozed()) setMode((m) => m ?? "ios");
      }, 2500);
    }

    // Hide once installed.
    function onInstalled() {
      setMode(null);
      setDeferred(null);
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!mode) return null;

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user dismissed the native sheet */
    }
    setDeferred(null);
    setMode(null);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(76,175,80,0.3)] bg-[#0B120B] p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>
            🌱
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Keep ThinkThru in your pocket</p>
            {mode === "android" ? (
              <p className="mt-0.5 text-xs text-ink-soft">
                Add it to your home screen — one tap, and you’ll get the morning hello and never miss
                what your circle is thinking.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-ink-soft">
                Tap the <span className="text-ink">Share</span> button below (the square with an
                arrow), then <span className="text-ink">Add to Home Screen</span> — that’s how iPhone
                lets you get notifications and the morning hello.
              </p>
            )}
          </div>
          <button
            onClick={snooze}
            aria-label="Not now"
            className="shrink-0 rounded-full px-1.5 text-ink-soft transition hover:text-ink"
          >
            ✕
          </button>
        </div>

        {mode === "android" && (
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={snooze} className="btn-ghost text-xs">
              Not now
            </button>
            <button onClick={install} className="btn-primary text-sm">
              Add to Home Screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
