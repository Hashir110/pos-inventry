// Chhota service worker: app offline bhi khul sake.
// - /_next/static/* (hashed files): cache-first
// - baaki same-origin GET (pages): network-first, fail ho to cache
// Firebase/Google ki cross-origin requests ko haath nahi lagata (Firestore ka apna offline cache hai).
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Page ne bataya: in routes ka HTML aur unke JS/CSS chunks abhi (online hote hue) cache kar lo,
// taake pehli offline refresh par bhi app khule.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "WARM" && Array.isArray(event.data.urls)) {
    event.waitUntil(warm(event.data.urls));
  }
});

async function warm(routes) {
  const pages = await caches.open(PAGES_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  const assets = new Set();

  for (const route of routes) {
    try {
      const response = await fetch(route, { credentials: "same-origin" });
      if (!response.ok) continue;
      await pages.put(route, response.clone());
      const html = await response.text();
      for (const match of html.matchAll(/\/_next\/static\/[^"'\\\s<>)]+/g)) assets.add(match[0]);
    } catch {
      // ek route fail ho to baqi chalte rahein
    }
  }

  await Promise.all(
    [...assets].map(async (asset) => {
      try {
        if (await statics.match(asset)) return;
        const response = await fetch(asset);
        if (response.ok) await statics.put(asset, response);
      } catch {
        // ignore
      }
    })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(PAGES_CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Navigation ke liye: koi bhi cached dashboard page (client app khud route sambhal leti hai)
    if (request.mode === "navigate") {
      const fallback = (await caches.match("/dashboard/pos")) || (await caches.match("/dashboard"));
      if (fallback) return fallback;
    }
    return new Response("Offline: yeh page abhi cache mein nahi hai. Internet on karke ek baar khol lein.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
