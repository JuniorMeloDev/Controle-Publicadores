'use client';

import { useEffect, useState } from 'react';
import { Mail, Loader2, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

export function PersonalAlertSettingsCard() {
    const [data, setData] = useState(null);
    const [enabled, setEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/admin/alertas/preferencias', { cache: 'no-store', signal: controller.signal }).then(async response => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setData(result); setEnabled(result.emailRemindersEnabled);
        }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
        return () => controller.abort();
    }, []);
    async function save(event) {
        event.preventDefault(); setSaving(true); setError(''); setMessage('');
        try {
            const response = await fetch('/api/admin/alertas/preferencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailRemindersEnabled: enabled }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setData(result); setEnabled(result.emailRemindersEnabled); setMessage('Sua preferência foi salva.');
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    }
    return <Card id="alertas" className="min-w-0 border-purple-200 bg-white text-gray-900 scroll-mt-24">
        <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-gray-900"><Mail className="h-5 w-5 shrink-0 text-purple-600" />Meus lembretes por e-mail</CardTitle>
            <CardDescription className="text-gray-600">O recebimento vem ativado para todos. Você pode desativar somente os seus lembretes aqui.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
            {!data ? !error && <p className="text-sm text-gray-500">Carregando sua preferência...</p> : <form onSubmit={save} className="space-y-4">
                <label className="flex items-start gap-3 text-sm font-medium">
                    <input type="checkbox" checked={enabled} disabled={saving} onChange={e => { setEnabled(e.target.checked); setMessage(''); }} className="mt-0.5 h-4 w-4 shrink-0 accent-purple-600" />
                    Receber lembretes das minhas designações por e-mail
                </label>
                <p className="break-words text-sm text-gray-600">{data.email ? `E-mail cadastrado: ${data.email}` : 'Você precisa ter um e-mail cadastrado para receber os lembretes.'}</p>
                {!data.automaticEmailActive && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">O envio automático geral ainda está desativado. Sua preferência será respeitada quando ele for ativado.</p>}
                <p className="text-xs text-gray-500">Essa opção não altera as notificações do sininho nem o recebimento das outras pessoas.</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button type="submit" disabled={saving} className="min-h-11 w-full bg-purple-600 text-white hover:bg-purple-700 sm:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar minha preferência</Button>
                    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                </div>
            </form>}
        </CardContent>
    </Card>;
}
