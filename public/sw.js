// Offline support. Pages, scripts and styles are fetched from the network
// first so a deploy shows up immediately, with the cache as the offline
// fallback. Fonts, icons and images are served from the cache. CACHE carries
// APP_VERSION from js/home.js; bump both together (see AGENTS.md).
const CACHE = 'divide-and-conquer-v1.00';

const SHELL = [
  '/',
  '/multiplication/',
  '/division/',
  '/missing-factor/',
  '/review-multiply/',
  '/review-divide/',
  '/progress/',
  '/privacy',
  '/manifest.webmanifest',
  '/css/style.css',
  '/css/fonts.css',
  '/css/game.css',
  '/css/grid-common.css',
  '/css/help.css',
  '/css/privacy.css',
  '/js/theme.js',
  '/js/translations.js',
  '/js/i18n.js',
  '/js/store.js',
  '/js/learning.js',
  '/js/home.js',
  '/js/help.js',
  '/js/pwa.js',
  '/js/privacy.js',
  '/multiplication/css/multiplication.css',
  '/multiplication/js/multiplication.js',
  '/division/css/division.css',
  '/division/js/division.js',
  '/missing-factor/css/missing-factor.css',
  '/missing-factor/js/missing-factor.js',
  '/review-multiply/css/review.css',
  '/review-multiply/js/review-multiply.js',
  '/review-divide/css/review.css',
  '/review-divide/js/review-divide.js',
  '/progress/css/progress.css',
  '/progress/js/progress.js',
  '/fonts/bricolage-grotesque-latin.woff2',
  '/fonts/bricolage-grotesque-latin-ext.woff2',
  '/fonts/figtree-latin.woff2',
  '/fonts/figtree-latin-ext.woff2',
  '/icons/icon-32.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const FROM_CACHE_FIRST = ['font', 'image'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One bad URL must not fail the whole install.
    await Promise.all(SHELL.map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      // The host redirects /progress to /progress/ and /privacy.html to
      // /privacy, and the pages are cached under those URLs, so an offline
      // visit to the other form must look there before it settles for the
      // home page.
      const url = new URL(request.url);
      if (!url.pathname.endsWith('/')) {
        const page = await cache.match(url.pathname + '/')
          || await cache.match(url.pathname.replace(/\.html$/, ''));
        if (page) return page;
      }
      const home = await cache.match('/');
      if (home) return home;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never hand out a cached copy of the worker itself.
  if (url.pathname === '/sw.js') return;

  event.respondWith(
    FROM_CACHE_FIRST.includes(request.destination)
      ? cacheFirst(request)
      : networkFirst(request)
  );
});
