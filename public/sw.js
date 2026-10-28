const CACHE_VERSION = 'signsync-v1';
const APP_CACHE = `${CACHE_VERSION}-app`;
const MODEL_CACHE = `${CACHE_VERSION}-models`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/Logo_1.jpg',
  '/favicon.svg',
];

const MODEL_ASSETS = [
  '/models/model_manifest.json',
  '/models/static_mlp/model.json',
  '/models/static_mlp/group1-shard1of1.bin',
  '/models/static_mlp/metadata.json',
  '/models/dynamic_gru/model.json',
  '/models/dynamic_gru/group1-shard1of1.bin',
  '/models/dynamic_gru/metadata.json',
  '/models/avatar_poses.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)),
    caches.open(MODEL_CACHE).then((cache) => cache.addAll(MODEL_ASSETS)),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => ![APP_CACHE, MODEL_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName, ignoreSearch = false) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
  return response;
}

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_CACHE);
    await cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await caches.match('/index.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/models/')) {
    event.respondWith(cacheFirst(request, MODEL_CACHE, true));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
