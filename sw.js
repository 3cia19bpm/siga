const CACHE_SIGA = 'siga-github-v5.7.2';
const ARQUIVOS_SIGA = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(evento) {
  evento.waitUntil(
    caches.open(CACHE_SIGA).then(function(cache) {
      return cache.addAll(ARQUIVOS_SIGA);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(evento) {
  evento.waitUntil(
    caches.keys().then(function(chaves) {
      return Promise.all(
        chaves
          .filter(function(chave) { return chave !== CACHE_SIGA; })
          .map(function(chave) { return caches.delete(chave); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(evento) {
  if (evento.request.method !== 'GET') return;
  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(evento.request, {
      cache: evento.request.mode === 'navigate' ? 'reload' : 'no-store'
    })
      .then(function(resposta) {
        const copia = resposta.clone();
        caches.open(CACHE_SIGA).then(function(cache) {
          cache.put(evento.request, copia);
        });
        return resposta;
      })
      .catch(function() {
        return caches.match(evento.request).then(function(resposta) {
          return resposta || caches.match('./index.html');
        });
      })
  );
});
