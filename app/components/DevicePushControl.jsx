'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { applicationServerKey, clearDevicePush, requestDevicePush, supportsDevicePush } from '@/app/lib/push-client';

const subscribeToSupport = () => () => {};
const serverSupport = () => null;

export function DevicePushControl({ userId = null, general = false, combined = false, inviteOnEntry = false }) {
  const sessionUserId = userId === null ? null : Number(userId);
  const enableOnLogin = inviteOnEntry && general && sessionUserId === null;
  const supported = useSyncExternalStore(subscribeToSupport, supportsDevicePush, serverSupport);
  const [loadedDevice, setDevice] = useState(null);
  const device = loadedDevice?.userId === sessionUserId ? loadedDevice : null;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const settingsButton = useRef(null);

  useEffect(() => {
    if (!supportsDevicePush()) return;
    const controller = new AbortController();
    async function load() {
      try {
        const [registration, status] = await Promise.all([
          navigator.serviceWorker.getRegistration('/'),
          requestDevicePush(general, 'GET', undefined, controller.signal),
        ]);
        const subscription = await registration?.pushManager.getSubscription();
        if (controller.signal.aborted) return;
        if (status.userId !== sessionUserId) throw new Error('Sua conta mudou. Atualize a página e tente novamente.');
        const enabled = combined ? status.personalizedEnabled && status.generalEnabled
          : enableOnLogin ? status.enabled && status.enabledOnLogin : status.enabled;
        setDevice({ ...status, enabled, registration, subscription });
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error.message);
      }
    }
    load();
    navigator.serviceWorker.addEventListener('controllerchange', load);
    window.addEventListener('focus', load);
    window.addEventListener('device-push:updated', load);
    return () => {
      controller.abort();
      navigator.serviceWorker.removeEventListener('controllerchange', load);
      window.removeEventListener('focus', load);
      window.removeEventListener('device-push:updated', load);
    };
  }, [combined, enableOnLogin, general, sessionUserId, revision]);

  async function toggle() {
    if (busy || !device) return;
    setBusy(true);
    setMessage('');
    try {
      const account = { userId: sessionUserId, ...(combined && { includeGeneral: true }), ...(enableOnLogin && { enableOnLogin: true }) };
      if (device.enabled) {
        await requestDevicePush(general, 'DELETE', account);
        await clearDevicePush({ registration: device.registration, general, includeGeneral: combined || enableOnLogin });
        setInviteDismissed(true);
        setDevice(current => ({ ...current, enabled: false }));
        setMessage(combined || enableOnLogin ? 'Notificações desativadas neste aparelho.' : general ? 'Avisos gerais desativados.' : 'Notificações personalizadas desativadas.');
        window.dispatchEvent(new Event('device-push:updated'));
        return;
      }
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(permission === 'denied'
          ? 'Permissão bloqueada. Você pode alterá-la nas configurações do navegador ou do aparelho.'
          : 'Permissão para notificações ainda não concedida.');
        return;
      }
      const key = applicationServerKey(device.publicKey);
      const manager = device.registration.pushManager;
      // O navegador pode manter uma inscrição que o servidor já descartou.
      let subscription = device.subscription;
      const reuse = subscription && subscription.endpoint === device.endpoint && device.subscriptionKey === device.publicKey;
      if (!reuse) {
        if (subscription) await subscription.unsubscribe();
        subscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      await requestDevicePush(general, 'PUT', { ...account, publicKey: device.publicKey, subscription: subscription.toJSON() });
      setInviteDismissed(true);
      setDevice(current => ({ ...current, enabled: true, endpoint: subscription.endpoint, subscriptionKey: device.publicKey, subscription }));
      setMessage(enableOnLogin ? 'Notificações ativadas. Entre na sua conta para receber seus avisos neste aparelho.'
        : combined ? 'Notificações ativadas neste aparelho.' : general ? 'Avisos gerais ativados.' : 'Notificações personalizadas ativadas.');
      window.dispatchEvent(new Event('device-push:updated'));
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar as notificações neste aparelho.');
    } finally {
      setBusy(false);
      setRevision(current => current + 1);
    }
  }

  if (supported === null) return null;
  const available = device?.registration?.active && device.publicKey && Notification.permission !== 'denied';
  const inactive = device?.enabled && (device.subscription?.endpoint !== device.endpoint
    || device.subscriptionKey !== device.publicKey || Notification.permission !== 'granted');
  const inviteOpen = inviteOnEntry && general && supported && available && !device.enabled && !inviteDismissed;
  const label = combined || enableOnLogin ? 'notificações' : general ? 'avisos gerais' : 'notificações personalizadas';
  return <div className="space-y-1 text-sm">
    {supported ? <Button ref={settingsButton} type="button" variant="outline" size="sm" disabled={busy || (!device?.enabled && !available)} onClick={toggle}>
      {device?.enabled ? `Desativar ${label}` : `Ativar ${label}`}
    </Button> : <p className="text-gray-600">Notificações no aparelho indisponíveis neste navegador. No iPhone ou iPad, abra o app pela Tela de Início.</p>}
    {message ? <p role="status" className="text-gray-600">{message}</p>
      : supported && Notification.permission === 'denied' ? <p className="text-gray-600">Permissão bloqueada nas configurações do navegador ou do aparelho.</p>
      : inactive ? <p className="text-gray-600">Para receber novamente, desative e reative as notificações neste aparelho.</p>
      : device && !device.publicKey ? <p className="text-gray-600">As notificações no aparelho ainda não foram configuradas.</p>
      : device && !device.registration?.active ? <p className="text-gray-600">Preparando as notificações neste aparelho…</p> : null}
    {inviteOnEntry && <Dialog open={Boolean(inviteOpen)} onOpenChange={open => { if (!open) setInviteDismissed(true); }}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-sm rounded-xl text-foreground"
        onCloseAutoFocus={event => {
          event.preventDefault();
          (settingsButton.current?.disabled ? document.getElementById('email') : settingsButton.current)?.focus();
        }}>
        <DialogHeader>
          <DialogTitle className="pr-5">Quer receber notificações?</DialogTitle>
          <DialogDescription>Receba avisos neste aparelho, mesmo com o site fechado. Depois de entrar, você também recebe os avisos da sua conta.</DialogDescription>
        </DialogHeader>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setInviteDismissed(true)}>Agora não</Button>
          <Button type="button" disabled={busy} onClick={toggle}>{busy ? 'Ativando…' : 'Ativar notificações'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </div>;
}
