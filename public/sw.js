// FairShift service worker (fairshift-v2).
// Worker pages under /w (except /w/login) use a network-first strategy and are stored
// in a separate 'fairshift-pages' cache so workers can view their last-seen pages offline.
// Admin routes (/admin/*) and login (/w/login) are NEVER cached.
// Static build assets and icons are cached in 'fairshift-v2' (cache-first).
// Logging out deletes 'fairshift-pages' to protect worker privacy on shared devices.

const CACHE = 'fairshift-v2';
const PAGES_CACHE = 'fairshift-pages';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const isWorkerRoute = url.pathname.startsWith('/w');
    const isLogin = url.pathname === '/w/login' || url.pathname.startsWith('/w/login/');

    if (isWorkerRoute && !isLogin) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.status === 200) {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('text/html')) {
                const copy = response.clone();
                caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
              }
            }
            return response;
          })
          .catch(() =>
            caches
              .open(PAGES_CACHE)
              .then((cache) =>
                cache.match(request).then((exact) => {
                  if (exact) return exact;
                  return cache.match('/w').then((home) => {
                    if (home) return home;
                    return caches.match(OFFLINE_URL);
                  });
                }),
              )
              .catch(() => caches.match(OFFLINE_URL)),
          ),
      );
      return;
    }

    // Other navigations (/admin/*, /, /w/login, etc.)
    // Never cache /admin/* or /w/login
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
