const CACHE_NAME = "nfl-pickem-cache-v1";
const urlsToCache = [
  "/",
  "/offline", // Optional: you can create a friendly offline page
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/manifest.json",
];

// 🔄 Install and cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const { title, body } = data;

  event.waitUntil(
    self.registration.showNotification(title || "NFL Pick'em", {
      body: body || "You've got a new update!",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
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

// 📦 Fetch handler
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return (
        response || fetch(event.request).catch(() => caches.match("/offline")) // optional fallback
      );
    })
  );
});
