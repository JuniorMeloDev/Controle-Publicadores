// Service Worker para PWA do Controle de Publicadores
const CACHE_NAME = 'controle-publicadores-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/window.svg'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Falha ao cachear assets estáticos iniciais:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não interceptar chamadas de API ou extensões do Chrome
  if (url.pathname.startsWith('/api/') || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Não interceptar requisições POST, PUT, DELETE, etc.
  if (event.request.method !== 'GET') {
    return;
  }

  // Estratégia Network First para páginas, com fallback para o cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a resposta for válida, clonar e salvar no cache para uso offline
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback offline a partir do cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Se for requisição de navegação HTML, retornar a home do cache se existir
        if (event.request.mode === 'navigate') {
          const fallbackHome = await caches.match('/');
          if (fallbackHome) return fallbackHome;
        }
        return new Response('Offline - Conteúdo indisponível sem conexão', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
