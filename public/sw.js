/* KnowledgeKeeper app-shell worker. The build stamps BUILD with the cache
 * version and exact precache list; hashed files change whenever assets change.
 * The dev default keeps this file valid when Vite serves public/ unstamped. */
const BUILD = { version: 'dev', precache: [] };
const CACHE = `knowledgekeeper-${BUILD.version}`;
const PRECACHE = BUILD.precache;
const SHELL_URL = new URL('./', self.location.href);
const INDEX_URL = new URL('./index.html', self.location.href);
const ASSETS_URL = new URL('./assets/', self.location.href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith('knowledgekeeper-') && name !== CACHE)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hash routes are all the same document; keep it fresh online, usable offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          void caches.open(CACHE).then((cache) => {
            cache.put(SHELL_URL, response.clone());
          });
        }
        return response;
      }).catch(async () => (
        (await caches.match(SHELL_URL)) ?? (await caches.match(INDEX_URL))
        ?? Response.error()
      )),
    );
    return;
  }

  // Precached shell files and runtime-cached hashed JS/CSS are cache-first.
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok && url.pathname.startsWith(ASSETS_URL.pathname)) {
        void caches.open(CACHE).then((cache) => {
          cache.put(request, response.clone());
        });
      }
      return response;
    })),
  );
});
