// Whalyx Service Worker — stale-while-revalidate API + cache-first 정적
const VERSION       = "v1";
const STATIC_CACHE  = `whalyx-static-${VERSION}`;
const API_CACHE     = `whalyx-api-${VERSION}`;
const ALLOWED       = [STATIC_CACHE, API_CACHE];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !ALLOWED.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // 1) 정적 자원 — cache-first (빌드 산출물·폰트·이미지)
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(svg|png|jpg|jpeg|webp|gif|woff2?|ttf|eot|css|js|ico)$/.test(url.pathname);

  if (isStatic) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 2) Whalyx API — stale-while-revalidate (즉시 캐시 + 백그라운드 갱신)
  if (url.host.includes("onrender.com")) {
    e.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }
});
