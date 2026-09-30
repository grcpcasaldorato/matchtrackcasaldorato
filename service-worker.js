// ==========================================
// SERVICE WORKER — MatchTrack
// ==========================================
// Permite funcionar offline e ter comportamento de app nativa
// ==========================================

const CACHE_NAME = 'matchtrack-v1';
const FICHEIROS_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png',
  './manifest.json'
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 A guardar ficheiros em cache');
        return cache.addAll(FICHEIROS_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(
        nomes.map((nome) => {
          if (nome !== CACHE_NAME) {
            console.log('🗑️ A limpar cache antiga:', nome);
            return caches.delete(nome);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Não intercepta Supabase, CDNs externos (dexie, html2canvas, chart.js)
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((resposta) => {
      if (resposta) return resposta;

      return fetch(event.request).then((respostaRede) => {
        if (respostaRede && respostaRede.status === 200) {
          const respostaClone = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, respostaClone);
          });
        }
        return respostaRede;
      }).catch(() => {
        return new Response('Sem ligação e sem cache disponível.', {
          status: 503,
          statusText: 'Offline'
        });
      });
    })
  );
});