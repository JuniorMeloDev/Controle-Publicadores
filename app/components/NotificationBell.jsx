'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Calendar, ClipboardList, SprayCan, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { isAllowed } from '@/app/lib/access-control';

export function NotificationBell({ userId, permissions }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState({ notifications: [], unread: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [marking, setMarking] = useState(false);
    const load = useCallback(async (signal) => {
        if (!userId) return;
        try {
            const response = await fetch('/api/admin/notificacoes', { cache: 'no-store', signal });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setData(result); setError('');
        } catch (e) { if (e.name !== 'AbortError') setError(e.message || 'Falha ao carregar notificações.'); }
        finally { if (!signal?.aborted) setLoading(false); }
    }, [userId]);

    useEffect(() => {
        const controller = new AbortController();
        const refresh = () => load(controller.signal);
        refresh();
        const timer = setInterval(refresh, 60000);
        for (const event of ['focus', 'designacoes-atualizadas', 'alertas-atualizados']) window.addEventListener(event, refresh);
        return () => {
            controller.abort(); clearInterval(timer);
            for (const event of ['focus', 'designacoes-atualizadas', 'alertas-atualizados']) window.removeEventListener(event, refresh);
        };
    }, [load]);

    async function markRead(ids) {
        setMarking(true);
        try {
            const response = await fetch('/api/admin/notificacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setData(result); setError('');
        } catch (e) { setError(e.message); }
        finally { setMarking(false); }
    }

    return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) load(); }}>
        <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" disabled={!userId} aria-label={`Notificações${data.unread ? `: ${data.unread} não lidas` : ''}`}>
                <Bell className="w-5 h-5 text-gray-500" />
                {data.unread > 0 && <span className="absolute -top-0.5 -right-1 rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{data.unread > 99 ? '99+' : data.unread}</span>}
            </Button>
        </DialogTrigger>
        <DialogContent className="bg-white text-gray-900 w-[calc(100%_-_2rem)] max-w-xl rounded-xl">
            <DialogHeader>
                <DialogTitle className="flex gap-2 items-center"><Bell className="w-5 h-5 text-purple-600" /> Suas notificações</DialogTitle>
                <DialogDescription>Designações, limpeza e relatório mensal, conforme os alertas da congregação.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-between items-center gap-2 text-sm">
                <span className="text-gray-500">{data.unread} não lidas</span>
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => load()} aria-label="Atualizar notificações"><RefreshCw className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" disabled={!data.unread || marking} onClick={() => markRead(data.notifications.filter(n => !n.read).map(n => n.id))}><CheckCheck className="w-4 h-4 mr-1" />Marcar todas como lidas</Button>
                </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {loading ? <p className="text-center py-8 text-gray-500">Carregando notificações...</p> : !data.notifications.length && !error ? <p className="text-center py-8 text-gray-500">Nenhum alerta no momento.</p> : data.notifications.map(n => {
                    const Icon = n.category === 'limpeza' ? SprayCan : n.category === 'relatorio' ? ClipboardList : Calendar;
                    const canOpen = n.category === 'relatorio' || isAllowed(permissions, 'designacoes', 'pages');
                    return <div key={n.id} className={`p-3 rounded-lg border flex gap-3 ${n.read ? 'bg-white border-gray-200' : n.overdue ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-100'}`}>
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${n.overdue ? 'text-red-600' : 'text-purple-600'}`} />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{n.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{n.detail}</p>
                            <p className="text-xs text-gray-500 mt-1">{n.date.split('-').reverse().join('/')}</p>
                            <div className="flex gap-3 mt-2 text-xs">
                                {canOpen && <Link className="text-purple-700 hover:underline" href={n.href} onClick={() => setOpen(false)}>{n.category === 'relatorio' ? 'Enviar relatório' : 'Ver programação'}</Link>}
                                {!n.read && <button className="text-gray-600 hover:underline" disabled={marking} onClick={() => markRead([n.id])}>Marcar como lida</button>}
                            </div>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-purple-600 rounded-full shrink-0 mt-1" aria-label="Não lida" />}
                    </div>;
                })}
            </div>
            {isAllowed(permissions, 'configuracoes', 'pages') && <Link className="text-sm text-purple-700 hover:underline" href="/admin/configuracoes#alertas" onClick={event => {
                if (window.location.pathname === '/admin/configuracoes') {
                    event.preventDefault();
                    window.location.hash = 'alertas';
                }
                setOpen(false);
            }}>Configurar alertas</Link>}
        </DialogContent>
    </Dialog>;
}
