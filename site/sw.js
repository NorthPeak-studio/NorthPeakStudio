/**
 * NorthPeak Studio — Service Worker
 * Strategy:
 *   - Network-first dla HTML (fresh content, fallback do cache offline)
 *   - Cache-first dla statics (CSS/JS/fonts/images) z stale-while-revalidate
 *   - Skip non-GET, skip cross-origin
 */

const VERSION = 'nps-2026-05-07-v2';
const STATIC_CACHE = `static-${VERSION}`;
const DYNAMIC_CACHE = `dynamic-${VERSION}`;
const HTML_CACHE = `html-${VERSION}`;

// Core shell — cached on install, served offline
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/style.css',
  '/app.js',
  '/i18n.js',
  '/manifest.webmanifest',
  '/assets/logo.svg',
  '/assets/signature.png',
  '/assets/octa-logo.png',
  '/assets/pwa/icon-192.png',
  '/assets/pwa/icon-512.png',
  '/assets/pwa/apple-touch-icon.png',
  '/assets/pwa/favicon-32.png',
];

// Offline fallback — branded page when network fails
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Use addAll with allSettled-style robustness — single missing file
      // shouldn't block install
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      // Take control of all clients (no reload needed)
      await self.clients.claim();
      // Enable navigation preload if supported (faster nav)
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (e) {}
      }
    })()
  );
});

// Helper: stale-while-revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type !== 'opaque') {
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  return cached || network || new Response('', { status: 504 });
}

// Helper: network-first (HTML/navigation)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    // Try preload first
    const preload = await self.registration?.navigationPreload?.getState?.();
    let networkRes;
    if (preload?.enabled) {
      // Browser will deliver preload via fetch event's preloadResponse — handled in caller
      networkRes = await fetch(request);
    } else {
      networkRes = await fetch(request);
    }
    if (networkRes && networkRes.ok) {
      cache.put(request, networkRes.clone()).catch(() => {});
      return networkRes;
    }
    throw new Error('Bad response');
  } catch (err) {
    // Fallback to cache, then offline page
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin (e.g. fonts.googleapis, formsubmit) — let browser handle
  if (url.origin !== self.location.origin) return;

  // HTML / navigation requests → network-first
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, HTML_CACHE));
    return;
  }

  // Static assets → stale-while-revalidate
  const dest = req.destination;
  if (
    dest === 'style' ||
    dest === 'script' ||
    dest === 'image' ||
    dest === 'font' ||
    dest === 'video' ||
    dest === 'audio' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(staleWhileRevalidate(req, DYNAMIC_CACHE));
    return;
  }

  // Default: try network, fallback cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((c) => c || new Response('', { status: 504 })))
  );
});

// Listen for skipWaiting messages from clients (e.g. update prompt)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
