// =====================================================
//  FINANÇA ROSA — Service Worker
//  Estratégia: Cache-first (assets locais)
//              Stale-while-revalidate (CDN)
//              Network-first (Firebase / APIs)
// =====================================================

// 🔑 Mudar este valor em cada deploy força atualização em todos os dispositivos
const CACHE_NAME = 'financa-rosa-v6';

// Assets locais — pré-carregados no install
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png',
  './logo-financa-rosa.png',
];

// CDN externos — cached on first use (stale-while-revalidate)
const CDN_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://www.gstatic.com',
  'https://cdn.jsdelivr.net',
];

// Domínios que NUNCA devem ser servidos da cache (dados em tempo real)
const NETWORK_ONLY_ORIGINS = [
  'https://financas-f4bfe-default-rtdb.europe-west1.firebasedatabase.app',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://geocoding-api.open-meteo.com',
  'https://api.open-meteo.com',
];

// ─── INSTALL ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // toma controlo imediatamente
  );
});

// ─── ACTIVATE ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME) // apagar caches antigas
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // tomar controlo de todos os tabs abertos
  );
});

// ─── MENSAGENS DA APP → SW ─────────────────────────
// Permite que a app peça ao SW para se atualizar imediatamente
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── FETCH ────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar pedidos não-GET
  if (request.method !== 'GET') return;

  // 1) Network-only: Firebase DB + APIs em tempo real
  const isNetworkOnly = NETWORK_ONLY_ORIGINS.some(o => request.url.startsWith(o));
  if (isNetworkOnly) {
    event.respondWith(fetch(request));
    return;
  }

  // 2) Cache-first: assets locais (mesmo origin)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3) Stale-while-revalidate: CDN externos (Firebase SDK, Chart.js, etc.)
  const isCDN = CDN_ORIGINS.some(o => url.origin === o || request.url.startsWith(o));
  if (isCDN) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Tudo o resto: network com fallback à cache
  event.respondWith(networkWithCacheFallback(request));
});

// ─── ESTRATÉGIAS ──────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline e sem cache: devolver página principal como fallback
    return caches.match('./index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}

async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}
