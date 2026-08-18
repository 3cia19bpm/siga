const CACHE_SIGA = 'siga-github-v5.9.0-r9.9.1';
const INDEX_SIGA = './index.html';
const ARQUIVOS_ESSENCIAIS_SIGA = [
  './',
  INDEX_SIGA,
  './manifest.json'
];
const ARQUIVOS_OPCIONAIS_SIGA = [
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(evento) {
  evento.waitUntil(
    caches.open(CACHE_SIGA).then(function(cache) {
      return cache.addAll(ARQUIVOS_ESSENCIAIS_SIGA).then(function() {
        return Promise.all(ARQUIVOS_OPCIONAIS_SIGA.map(function(arquivo) {
          return cache.add(arquivo).catch(function() {
            /* Um ícone ausente não deve impedir a instalação do modo offline. */
            return undefined;
          });
        }));
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(evento) {
  evento.waitUntil(
    caches.keys().then(function(chaves) {
      return Promise.all(
        chaves
          .filter(function(chave) { return chave !== CACHE_SIGA && chave.indexOf('siga-github-') === 0; })
          .map(function(chave) { return caches.delete(chave); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

function respostaCacheavel(resposta) {
  return Boolean(resposta && resposta.ok && (resposta.type === 'basic' || resposta.type === 'default'));
}

function salvarResposta(request, resposta) {
  if (!respostaCacheavel(resposta)) return Promise.resolve(resposta);
  const copia = resposta.clone();
  return caches.open(CACHE_SIGA).then(function(cache) {
    return cache.put(request, copia);
  }).then(function() {
    return resposta;
  });
}

function respostaOffline() {
  return new Response('SIGA temporariamente indisponível sem conexão.', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type':'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', function(evento) {
  if (evento.request.method !== 'GET') return;
  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  if (evento.request.mode === 'navigate') {
    evento.respondWith(
      fetch(evento.request, { cache:'no-store' })
        .then(function(resposta) {
          if (!respostaCacheavel(resposta)) return resposta;
          const copia = resposta.clone();
          return caches.open(CACHE_SIGA).then(function(cache) {
            return Promise.all([
              cache.put(evento.request, copia),
              cache.put(INDEX_SIGA, resposta.clone())
            ]);
          }).then(function() { return resposta; });
        })
        .catch(function() {
          return caches.match(evento.request).then(function(resposta) {
            return resposta || caches.match(INDEX_SIGA);
          }).then(function(resposta) {
            return resposta || respostaOffline();
          });
        })
    );
    return;
  }

  evento.respondWith(
    fetch(evento.request, { cache:'no-cache' })
      .then(function(resposta) { return salvarResposta(evento.request, resposta); })
      .catch(function() {
        return caches.match(evento.request).then(function(resposta) {
          return resposta || respostaOffline();
        });
      })
  );
});
