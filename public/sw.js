const CACHE_NAME = "nfl-pickem-cache-v1";
const urlsToCache = [
  "/login",
  "/register",
  "/offline.html", // Make sure this file exists
  "/icons/app-icon.png",
  "/manifest.json",
];

// 🔄 Install and cache essential files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 🚀 Activate and clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

// 📦 Serve cached assets or fallback to network
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response || fetch(event.request).catch(() => caches.match("/offline"))
      );
    })
  );
});

// 🔔 Show push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const { title, body } = data;

  event.waitUntil(
    self.registration.showNotification(title || "NFL Pick'em", {
      body: body || "You've got a new update!",
      icon: "/icons/app-icon.png",
      badge: "/icons/app-icon.png",
    })
  );
});

// 🚪 Handle clicks on notifications
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
