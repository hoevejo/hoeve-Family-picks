const CACHE_NAME = "nfl-pickem-cache-v1";
const urlsToCache = [
  "/login",
  "/register",
  "/offline.html",
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

// 📦 Serve cached assets or fallback to network (exclude Firebase listen calls)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const ignored = [
    "googleapis.com/google.firestore.v1.Firestore", // Firebase realtime listeners
    "chrome-extension",
    "sockjs",
    "/sw.js",
  ];
  if (ignored.some((str) => event.request.url.includes(str))) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() => caches.match("/offline.html"))
      );
    })
  );
});

// 🔔 Show push notifications
self.addEventListener("push", (event) => {
  console.log("📨 Push received by service worker!");

  const data = event.data?.json() || {};
  console.log("Push payload:", data);

  const { title, body, url } = data;

  event.waitUntil(
    self.registration.showNotification(title || "NFL Pick'em", {
      body: body || "You've got a new update!",
      icon: "/icons/app-icon.png",
      badge: "/icons/app-icon.png",
      data: { url: url || "/" },
    })
  );
});

// 🚪 Handle clicks on notifications
self.addEventListener("notificationclick", (event) => {
  const url = event.notification.data?.url || "/";
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
