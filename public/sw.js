// Service worker of the installed shop. It does one thing: when a page cannot be loaded because the
// phone is offline, it shows /offline.html instead of the browser's error. Nothing else is cached, so
// prices, stock and the cart always come from the server.
const CACHE = "offline-v1";
const OFFLINE = ["/offline.html", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  } else if (new URL(request.url).pathname === "/logo.png") {
    event.respondWith(fetch(request).catch(() => caches.match("/logo.png")));
  }
});
