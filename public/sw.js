// Service worker of the installed shop. It does two things:
// - when a page cannot be loaded because the phone is offline, it shows /offline.html instead of the
//   browser's error (nothing else is cached, so prices, stock and the cart always come from the server);
// - it shows the notifications the shop sends (order updates) and opens the right page when one is tapped.
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

// A message from the shop: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Поръчки за малки и големи", {
      body: message.body || "",
      icon: "/icon-192.png",
      // Android's status bar draws this one in a single colour.
      badge: "/badge-96.png",
      // A newer update about the same order replaces the older one.
      tag: message.tag,
      renotify: Boolean(message.tag),
      lang: "bg",
      data: { url: message.url || "/" },
    }),
  );
});

// A tap opens the page the notification is about, in the app's window if one is already open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(url);
      await open.focus();
      return open.navigate ? open.navigate(url).catch(() => self.clients.openWindow(url)) : self.clients.openWindow(url);
    }),
  );
});
