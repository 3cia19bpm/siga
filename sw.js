const CACHE_SIGA = 'siga-github-v5.9.1-governanca';
const SCRIPT_GOVERNANCA = './governanca-acesso.js';
const ARQUIVOS_SIGA = [
  './',
  './index.html',
  './manifest.json',
  './governanca-acesso.js',
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

function injetarGovernanca(resposta) {
  if (!resposta) return Promise.resolve(resposta);
  const tipo = resposta.headers.get('content-type') || '';
  if (!tipo.includes('text/html')) return Promise.resolve(resposta);

  return resposta.text().then(function(html) {
    const tag = '<script src="' + SCRIPT_GOVERNANCA + '"></script>';
    const htmlProtegido = html.includes('governanca-acesso.js')
      ? html
      : (html.includes('</body>') ? html.replace('</body>', tag + '\n</body>') : html + '\n' + tag);

    const cabecalhos = new Headers(resposta.headers);
    cabecalhos.delete('content-length');
    cabecalhos.delete('content-encoding');

    return new Response(htmlProtegido, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers: cabecalhos
    });
  });
}

function respostaOffline(evento) {
  return caches.match(evento.request).then(function(resposta) {
    if (resposta) {
      return evento.request.mode === 'navigate' ? injetarGovernanca(resposta) : resposta;
    }
    if (evento.request.mode !== 'navigate') return Response.error();
    return caches.match('./index.html').then(function(index) {
      return injetarGovernanca(index);
    });
  });
}

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
        return evento.request.mode === 'navigate' ? injetarGovernanca(resposta) : resposta;
      })
      .catch(function() {
        return respostaOffline(evento);
      })
  );
});
