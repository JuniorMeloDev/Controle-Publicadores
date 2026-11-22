export function fieldNoticeFromHash(hash) {
  const match = /^#aviso-campo-([1-9][0-9]{0,18})$/.exec(hash);
  return match ? `campo-saida:${match[1]}` : null;
}

export function notificationFromHash(hash) {
  if (!hash.startsWith('#aviso-pessoal=')) return fieldNoticeFromHash(hash);
  try {
    const id = decodeURIComponent(hash.slice('#aviso-pessoal='.length));
    return id.length > 0 && id.length <= 512 ? id : null;
  } catch { return null; }
}

export function boardNoticeFromHash(hash) {
  const match = /^#aviso-mural-([1-9][0-9]{0,9})$/.exec(hash);
  return match ? Number(match[1]) : null;
}

export function supportsDevicePush() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function requestDevicePush(general, method = 'GET', body, signal) {
  const path = general ? '/api/notificacoes/web-push' : '/api/admin/notificacoes/web-push';
  const response = await fetch(path, {
    method, cache: 'no-store', credentials: 'same-origin', signal,
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Não foi possível atualizar as notificações neste aparelho.');
  return result;
}

export function applicationServerKey(publicKey) {
  const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

export async function clearDevicePush({ registration, general = false, includeGeneral = false, unsubscribe = false } = {}) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const worker = registration || await navigator.serviceWorker.getRegistration('/');
    if (!worker) return;
    await Promise.allSettled([
      unsubscribe && worker.pushManager?.getSubscription().then(subscription => subscription?.unsubscribe()),
      worker.getNotifications?.().then(notifications => {
        const prefixes = general && !includeGeneral ? ['geral-'] : ['campo-', 'alerta-', 'mural-'];
        if (includeGeneral) prefixes.push('geral-');
        notifications.filter(item => prefixes.some(prefix => item.tag.startsWith(prefix))).forEach(item => item.close());
      }),
    ]);
  } catch {
    // A revogação no servidor independe da disponibilidade do navegador.
  }
}

export async function logoutDevice() {
  const response = await fetch('/api/logout', { method: 'POST' });
  if (!response.ok) throw new Error('Não foi possível sair da conta.');
  const { pushCleanupFailed } = await response.json();
  await clearDevicePush({ unsubscribe: pushCleanupFailed });
}
