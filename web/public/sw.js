/* ThinkThru service worker — Web Push receiver + static-asset cache.
   Kept dependency-free so it loads instantly. */

// Bump this to invalidate old caches on deploy.
const CACHE = "thinkthru-static-v1";

// The brand visuals that make the launch/splash feel instant — precached so the
// emblem and icons paint from cache the moment the app opens.
const PRECACHE = [
  "/emblem.png",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon-32.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// What we cache: immutable build assets and our own static files (cache-first),
// plus Google Fonts (stale-while-revalidate). We deliberately DON'T cache HTML
// navigations or /api responses — those stay network-only so pages are always
// fresh and never leak a previous user's authenticated view on a shared device.
function isImmutableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      /\.(?:png|svg|ico|webmanifest|woff2?|mp3|wav)$/.test(url.pathname))
  );
}
function isGoogleFonts(url) {
  return url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone()).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isGoogleFonts(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Everything else (HTML navigations, /api, data): let the network handle it.
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
