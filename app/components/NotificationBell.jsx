'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Calendar, ClipboardList, MapPin, SprayCan, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { isAllowed } from '@/app/lib/access-control';
import { requestNotifications } from '@/app/lib/notification-client';
import { fieldNoticeFromHash } from '@/app/lib/push-client';
import { DevicePushControl } from '@/app/components/DevicePushControl';

export function NotificationBell({ userId, permissions }) {
    const [open, setOpen] = useState(false);
    const [targetId, setTargetId] = useState(null);
    const [data, setData] = useState({ notifications: [], unread: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [marking, setMarking] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const requestVersion = useRef(0);
    const markingRef = useRef(false);
    const handleError = useCallback(e => {
        if (e.status === 401) {
            setSessionExpired(true);
            setData({ notifications: [], unread: 0 });
        }
        setError(e.message || 'Falha ao carregar notificações.');
    }, []);
    const load = useCallback(async (signal) => {
        if (!userId || markingRef.current) return;
        const version = ++requestVersion.current;
        try {
            const result = await requestNotifications({ signal });
            if (version !== requestVersion.current || signal?.aborted) return;
            setData(result); setError(''); setSessionExpired(false);
        } catch (e) { if (e.name !== 'AbortError' && version === requestVersion.current) handleError(e); }
        finally { if (!signal?.aborted && version === requestVersion.current) setLoading(false); }
    }, [userId, handleError]);

    useEffect(() => {
        const controller = new AbortController();
        const refresh = () => load(controller.signal);
        const openNotice = () => {
            const id = fieldNoticeFromHash(window.location.hash);
            if (!id || !userId) return false;
            setTargetId(id);
            setOpen(true);
            setLoading(true);
            refresh();
            return true;
        };
        if (!openNotice()) refresh();
        const timer = setInterval(refresh, 60000);
        for (const event of ['focus', 'designacoes-atualizadas', 'alertas-atualizados']) window.addEventListener(event, refresh);
        window.addEventListener('hashchange', openNotice);
        return () => {
            controller.abort(); clearInterval(timer);
            for (const event of ['focus', 'designacoes-atualizadas', 'alertas-atualizados']) window.removeEventListener(event, refresh);
            window.removeEventListener('hashchange', openNotice);
        };
    }, [load, userId]);

    function clearNotice() {
        setTargetId(null);
        if (fieldNoticeFromHash(window.location.hash)) {
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        }
    }

    async function markRead(ids) {
        if (markingRef.current || sessionExpired || !ids.length) return;
        markingRef.current = true;
        ++requestVersion.current;
        setMarking(true);
        try {
            const result = await requestNotifications({ ids });
            setData(result); setError('');
        } catch (e) { handleError(e); }
        finally { markingRef.current = false; setMarking(false); setLoading(false); }
    }

    const visibleNotices = targetId ? data.notifications.filter(n => n.id === targetId) : data.notifications;
    return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) load(); else clearNotice(); }}>
        <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" disabled={!userId} aria-label={`Notificações${data.unread ? `: ${data.unread} não lidas` : ''}`}>
                <Bell className="w-5 h-5 text-gray-500" />
                {data.unread > 0 && <span className="absolute -top-0.5 -right-1 rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{data.unread > 99 ? '99+' : data.unread}</span>}
            </Button>
        </DialogTrigger>
        <DialogContent className="bg-white text-gray-900 w-[calc(100%_-_2rem)] max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl">
            <DialogHeader>
                <DialogTitle className="flex gap-2 items-center"><Bell className="w-5 h-5 text-purple-600" /> Suas notificações</DialogTitle>
                <DialogDescription>Designações, serviço de campo, limpeza e relatório mensal.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm">
                <span className="text-gray-500">{data.unread} não lidas</span>
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" disabled={marking || sessionExpired} onClick={() => load()} aria-label="Atualizar notificações"><RefreshCw className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal" disabled={!data.unread || marking || sessionExpired} onClick={() => markRead(data.notifications.filter(n => !n.read).map(n => n.id))}><CheckCheck className="w-4 h-4 mr-1" />Marcar todas como lidas</Button>
                </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {sessionExpired && <Link href={targetId ? `/#aviso-campo-${targetId.split(':')[1]}` : '/'} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">Entrar novamente</Link>}
            {targetId && <Button variant="ghost" size="sm" className="justify-self-start" onClick={clearNotice}>Ver todas as notificações</Button>}
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {loading ? <p className="text-center py-8 text-gray-500">Carregando notificações...</p> : !visibleNotices.length && !error ? <p className="text-center py-8 text-gray-500">{targetId ? 'Este aviso não está disponível para a conta atual.' : 'Nenhum alerta no momento.'}</p> : visibleNotices.map(n => {
                    const Icon = n.category === 'campo' ? MapPin : n.category === 'limpeza' ? SprayCan : n.category === 'relatorio' ? ClipboardList : Calendar;
                    const canOpen = n.href && (n.category === 'relatorio' || isAllowed(permissions, 'designacoes', 'pages'));
                    return <div key={n.id} className={`p-3 rounded-lg border flex gap-3 ${n.read ? 'bg-white border-gray-200' : n.overdue ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-100'}`}>
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${n.overdue ? 'text-red-600' : 'text-purple-600'}`} />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{n.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{n.detail}</p>
                            <p className="text-xs text-gray-500 mt-1">{n.date.split('-').reverse().join('/')}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs">
                                {n.links?.map(link => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline">{link.label}</a>)}
                                {canOpen && <Link className="text-purple-700 hover:underline" href={n.href} onClick={() => setOpen(false)}>{n.category === 'relatorio' ? 'Enviar relatório' : 'Ver programação'}</Link>}
                                {!n.read && <button className="text-gray-600 hover:underline" disabled={marking} onClick={() => markRead([n.id])}>Marcar como lida</button>}
                            </div>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-purple-600 rounded-full shrink-0 mt-1" aria-label="Não lida" />}
                    </div>;
                })}
            </div>
            {!sessionExpired && userId && <div className="flex flex-wrap gap-2">
                <DevicePushControl userId={userId} />
                <DevicePushControl userId={userId} general />
            </div>}
            <Link className="text-sm text-purple-700 hover:underline" href={isAllowed(permissions, 'configuracoes', 'pages') ? '/admin/configuracoes#alertas' : '/admin/configuracoes/preferencias'} onClick={event => {
                if (window.location.pathname === '/admin/configuracoes' && isAllowed(permissions, 'configuracoes', 'pages')) {
                    event.preventDefault();
                    window.location.hash = 'alertas';
                }
                setOpen(false);
            }}>Configurar meus alertas</Link>
        </DialogContent>
    </Dialog>;
}
