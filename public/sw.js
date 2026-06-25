const CACHE_NAME = "munim-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/icon.svg",
  "/favicon.ico",
  "/manifest.webmanifest",
];

// 1. Install event: Cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Caching critical shell assets...");
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate event: Clean up legacy caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: Clearing old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-While-Revalidate & Offline Page fallback
self.addEventListener("fetch", (event) => {
  // Only intercept same-origin GET requests
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // Skip browser dev tools or hot-reloading extensions in Next.js development
  if (
    url.pathname.includes("_next/webpack-hmr") ||
    url.pathname.includes("hot-update") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-While-Revalidate: Serve cached response, update cache in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Silently absorb update error if offline
          });
        return cachedResponse;
      }

      // If not cached, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          // Cache successful asset fetches
          if (
            networkResponse.status === 200 &&
            (url.pathname.startsWith("/_next/") ||
              url.pathname.startsWith("/static/") ||
              url.pathname.endsWith(".js") ||
              url.pathname.endsWith(".css") ||
              url.pathname.endsWith(".png") ||
              url.pathname.endsWith(".svg") ||
              url.pathname.endsWith(".woff2"))
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          // If network fetch fails, provide offline fallback for HTML page requests
          const acceptHeader = event.request.headers.get("accept");
          if (acceptHeader && acceptHeader.includes("text/html")) {
            // Since it's a SPA-style React router, returning the root index HTML shell
            // allows the app to mount and render the correct view client-side.
            return caches.match("/");
          }
          throw error;
        });
    })
  );
});
