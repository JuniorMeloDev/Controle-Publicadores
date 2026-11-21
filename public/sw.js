// Service Worker para PWA do Controle de Publicadores
const CACHE_NAME = 'controle-publicadores-v2';

const STATIC_ASSETS = [
  new Request('/', { credentials: 'omit' }),
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
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não interceptar chamadas de API ou extensões do Chrome
  if (url.pathname.startsWith('/api/') || url.protocol.startsWith('chrome-extension')) {
    return;
  }
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')
    || url.searchParams.has('_rsc') || event.request.headers.has('RSC')) return;

  // Não interceptar requisições POST, PUT, DELETE, etc.
  if (event.request.method !== 'GET') {
    return;
  }

  // Estratégia Network First para páginas, com fallback para o cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a resposta for válida, clonar e salvar no cache para uso offline
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' && !networkResponse.redirected) {
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

const noticeHash = id => typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id) ? `#aviso-campo-${id}` : '';
const isGeneralId = id => typeof id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id);

self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (isGeneralId(payload?.generalId) && typeof payload.title === 'string' && typeof payload.body === 'string') {
    event.waitUntil(self.registration.showNotification(payload.title, {
      body: payload.body, icon: '/icon-192.png', tag: `geral-${payload.generalId}`, data: { generalId: payload.generalId },
    }));
    return;
  }
  if (!noticeHash(payload?.noticeId) || !Number.isSafeInteger(payload.outingId) || payload.outingId <= 0) return;
  event.waitUntil(self.registration.showNotification('Serviço de Campo', {
    body: 'Sua programação de campo foi atualizada',
    icon: '/icon-192.png',
    tag: `campo-${payload.outingId}`,
    data: { noticeId: payload.noticeId },
  }));
});

self.addEventListener('notificationclick', event => {
  const { data, tag } = event.notification;
  const path = tag.startsWith('geral-') && isGeneralId(data?.generalId) ? `/avisos/${data.generalId}`
    : tag.startsWith('campo-') ? `/admin/dashboard${noticeHash(data?.noticeId)}` : null;
  if (!path) return;
  event.notification.close();
  const url = new URL(path, self.location.origin);
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = tabs.find(client => {
      const current = new URL(client.url);
      return current.origin === url.origin && (current.pathname === '/' || current.pathname.startsWith('/admin/') || current.pathname.startsWith('/avisos/'));
    });
    if (tab) {
      try {
        const opened = tab.url === url.href ? tab : await tab.navigate(url.href);
        if (opened) return await opened.focus();
      } catch {
        // A janela pode ter fechado desde a consulta.
      }
    }
    return self.clients.openWindow(url.href);
  })());
});
