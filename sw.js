const CACHE_SIGA = 'siga-github-v5.9.0-r9.8.5-auditoria-2';
const ARQUIVOS_SIGA = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './brasao-pmce.png',
  './brasao-19bpm.png',
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
          .filter(function(chave) { return chave !== CACHE_SIGA && chave.indexOf('siga-github-') === 0; })
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
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          evento.waitUntil(
            caches.open(CACHE_SIGA)
              .then(function(cache) {
                return cache.put(evento.request, copia);
              })
              .catch(function() { return undefined; })
          );
        }
        return resposta;
      })
      .catch(function() {
        return caches.match(evento.request).then(function(resposta) {
          if (resposta) return resposta;
          if (evento.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
