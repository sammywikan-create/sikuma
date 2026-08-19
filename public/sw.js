const CACHE_NAME = 'sikuma-app-shell-v2';
const STATIC_ASSETS = [
  '/',
  '/masuk',
  '/kunjungan',
  '/kunjungan/baru',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Abaikan protokol non-HTTP/HTTPS (seperti chrome-extension://, moz-extension://, file://, data:)
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  // 2. Hanya proses request dengan metode GET
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // 3. Jangan pernah cache endpoint API, Supabase, atau stream laporan
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase')
  ) {
    return;
  }

  // 4. Strategi Cache-First untuk aset statis Next.js & font/gambar lokal
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone).catch((err) => {
                console.warn('SW cache put error:', err);
              });
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 5. Strategi Network-First dengan Fallback ke Cache untuk halaman App Shell
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch((err) => {
              console.warn('SW cache put error:', err);
            });
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return (
              caches.match('/kunjungan/baru') ||
              caches.match('/kunjungan') ||
              caches.match('/masuk')
            );
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
