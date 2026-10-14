'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registrado com sucesso (PWA ativo):', registration.scope);
          })
          .catch((error) => {
            console.warn('Falha ao registrar Service Worker:', error);
          });
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
