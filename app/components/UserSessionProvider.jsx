'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPrivateResource } from '@/app/lib/private-resource';

const UserSessionContext = createContext(null);

async function fetchJson(url, signal) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.message || 'Não foi possível carregar os dados.'); error.status = response.status; throw error; }
  return data;
}

export function UserSessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [personalData, setPersonalData] = useState(null);
  const [personalError, setPersonalError] = useState('');
  const userId = useRef(null);
  const alive = useRef(false);
  const [profileResource] = useState(() => createPrivateResource((_id, signal) => fetchJson('/api/usuario-atual', signal), { ttlMs: 60000 }));
  const [personalResource] = useState(() => createPrivateResource(async (id, signal) => {
    const data = await fetchJson('/api/minha-conta', signal);
    if (String(data.info?.id) !== String(id)) throw new Error('Dados de conta inválidos.');
    return data;
  }));

  const clearSession = useCallback(() => {
    profileResource.clear(); personalResource.clear();
    userId.current = null;
    setUser(null); setPersonalData(null); setPersonalError('');
  }, [profileResource, personalResource]);

  const refreshUser = useCallback(async ({ force = false } = {}) => {
    let cancelled = false;
    try {
      const next = await profileResource.load('current-session', { force });
      if (!alive.current) return;
      if (userId.current !== next.id) { personalResource.clear(); setPersonalData(null); }
      userId.current = next.id; setUser(next);
    } catch (error) {
      cancelled = error.name === 'AbortError';
      if (alive.current && error.name !== 'AbortError' && [401, 403, 404].includes(error.status)) clearSession();
    } finally { if (alive.current && !cancelled) setIsLoading(false); }
  }, [profileResource, personalResource, clearSession]);

  const loadPersonalData = useCallback(async ({ force = false } = {}) => {
    const id = userId.current;
    if (!id) return;
    try {
      const data = await personalResource.load(id, { force });
      if (alive.current && userId.current === id) { setPersonalData(data); setPersonalError(''); }
    } catch (error) {
      if (!alive.current || error.name === 'AbortError') return;
      if ([401, 403].includes(error.status)) clearSession();
      else setPersonalError(error.message);
    }
  }, [personalResource, clearSession]);

  useEffect(() => {
    alive.current = true;
    refreshUser();
    const refresh = () => { if (document.visibilityState === 'visible') refreshUser(); };
    const changed = () => refreshUser({ force: true });
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('session:changed', changed);
    window.addEventListener('session:logout', clearSession);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('session:changed', changed);
      window.removeEventListener('session:logout', clearSession);
      profileResource.clear(); personalResource.clear();
    };
  }, [refreshUser, clearSession, profileResource, personalResource]);

  return <UserSessionContext.Provider value={{ user, isLoading, personalData, personalError, loadPersonalData }}>{children}</UserSessionContext.Provider>;
}

export function useUserSession() {
  const session = useContext(UserSessionContext);
  if (!session) throw new Error('UserSessionProvider required');
  return session;
}
