/*
 * Service worker TIMS — sengaja dibuat konservatif.
 *
 * Tujuan: app shell tetap terbuka saat sinyal jelek / offline (lubang pabrik),
 * tanpa pernah men-cache data Supabase supaya data tidak pernah basi.
 *
 * Aturan:
 *  - Hanya request GET same-origin yang disentuh.
 *  - Request lintas-origin (Supabase, font CDN, dsb) dibiarkan lewat apa adanya.
 *  - Navigasi  : network-first, fallback app shell saat offline.
 *  - Aset statis: stale-while-revalidate (langsung dari cache, refresh di belakang).
 */
const CACHE = "tims-shell-v1";
const APP_SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Jangan pernah campur tangan request lintas-origin (Supabase & sejenisnya).
  if (url.origin !== self.location.origin) return;

  // Navigasi: coba jaringan dulu, kalau gagal pakai app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Aset statis: pakai cache dulu, perbarui di belakang layar.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
