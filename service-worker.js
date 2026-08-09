const CACHE_NAME = "pogo-boekenberg-home-v21";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./manifest.webmanifest",
  "./meetups/",
  "./bonuses/",
  "./perfect-cp/",
  "./assets/app-icon-180.png",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/meetup-rewards/calem.webp",
  "./assets/meetup-rewards/incense.webp",
  "./assets/meetup-rewards/link-charge.webp",
  "./assets/meetup-rewards/lucky-egg.webp",
  "./assets/meetup-rewards/lure-module.webp",
  "./assets/meetup-rewards/max-particles.webp",
  "./assets/meetup-rewards/pikachu-cap-blue.webp",
  "./assets/meetup-rewards/pikachu-cap-red.webp",
  "./assets/meetup-rewards/pikachu-cap-yellow.webp",
  "./assets/meetup-rewards/premium-battle-pass.webp",
  "./assets/meetup-rewards/rare-candy.webp",
  "./assets/meetup-rewards/serena.webp",
  "./assets/meetup-rewards/star-piece.webp",
  "./assets/meetup-rewards/super-incubator.webp",
  "./assets/meetup-rewards/ultra-ball.webp",
  "./assets/meetup-rewards/unknown-encounter.webp"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("pogo-boekenberg-home-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});
