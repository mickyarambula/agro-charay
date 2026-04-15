// AgroSistema Charay — Service Worker
// Estrategia:
//  - Network-first para navegación (HTML) → actualizaciones rápidas
//  - Cache-first para assets estáticos (JS/CSS/imagenes/iconos/manifest)
//  - Fallback al cache cuando no hay red
const CACHE = 'agro-charay-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(
      PRECACHE.map((url) => cache.add(url).catch((err) => {
        console.warn('[SW] precache miss', url, err);
      }))
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Solo manejamos mismo origen — external APIs (Supabase, Anthropic, CDN SheetJS) pasan directo.
  if (url.origin !== self.location.origin) return;

  // Navegación / documento → network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match('/index.html') || caches.match('/');
      }
    })());
    return;
  }

  // Assets estáticos → cache-first con update en background
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // Actualizar en segundo plano (stale-while-revalidate)
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
      }
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'AgroSistema Charay', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'agro-notif',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
