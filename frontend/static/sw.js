const CACHE_NAME = "oido-shell-v27";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/static/app.css?v=pdf-fix-6",
  "/static/app.js?v=pdf-fix-6",
  "/static/icons/logo%20audiometria.jpg",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
      return response;
    }).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
