/* ThinkThru service worker — Web Push receiver + click handler.
   Kept tiny and dependency-free so it loads instantly. */

// Take control immediately on install/activate so the PWA (and the Play Store
// TWA wrapper) sees an active SW right away.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A pass-through fetch handler. We don't cache (the app is online-first), but
// having a fetch listener is what makes the PWA pass installability checks —
// the precondition for wrapping it as an Android app.
self.addEventListener("fetch", () => {
  // Intentionally no-op: let the network handle every request normally.
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "ThinkThru", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ThinkThru";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is already open, else open a new one.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
