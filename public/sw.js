/* Mundo Pet PWA: cache only static shell and assets, never checkout or API responses. */
const CACHE_NAME = "mundo-pet-pwa-v2";
const SHELL = ["/", "/stitch-home.html", "/mp-app.css", "/icons/mundo-pet-192.png", "/icons/mundo-pet-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("mundo-pet-pwa-") && k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/auth/") || url.pathname.startsWith("/functions/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(request, { ignoreSearch: true }) || await cache.match("/");
    }));
    return;
  }
  const staticAsset = url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/media/brand/") || url.pathname.startsWith("/icons/") ||
    url.pathname === "/mp-app.css";
  if (staticAsset) {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
  }
});

