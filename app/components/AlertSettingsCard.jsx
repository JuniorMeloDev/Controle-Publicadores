'use client';

import { useEffect, useState } from 'react';
import { Bell, Save, Loader2, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';

export function AlertSettingsCard() {
    const { permissions, isLoading } = usePermissions();
    const canEdit = !isLoading && isAllowed(permissions, 'configuracoes_editar', 'actions');
    const canEmail = canEdit && isAllowed(permissions, 'designacoes_email', 'actions');
    const [data, setData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/admin/alertas/configuracoes', { cache: 'no-store', signal: controller.signal }).then(async response => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setData(result);
        }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
        return () => controller.abort();
    }, []);
    const change = (key, value) => { setData(previous => ({ ...previous, settings: { ...previous.settings, [key]: value } })); setMessage(''); };

    async function save(event) {
        event.preventDefault(); setSaving(true); setError(''); setMessage('');
        try {
            const response = await fetch('/api/admin/alertas/configuracoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.settings) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setData(result); setMessage('Alertas salvos.'); window.dispatchEvent(new Event('alertas-atualizados'));
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    }
    const checkbox = (key, label, disabled = !canEdit) => <label className="flex items-start gap-2 text-sm text-gray-800"><input type="checkbox" className="accent-purple-600 mt-0.5 h-4 w-4 shrink-0" checked={data.settings[key]} disabled={disabled || saving} onChange={e => change(key, e.target.checked)} /><span className="min-w-0">{label}</span></label>;
    const number = (key, label, max = 30, disabled = !canEdit) => <label className="flex justify-between items-center gap-3 text-sm text-gray-600"><span className="min-w-0">{label}</span><input type="number" required min="1" max={max} className="border rounded-md px-2 py-2 w-20 shrink-0 text-gray-900" value={data.settings[key]} disabled={disabled || saving} onChange={e => change(key, e.target.value === '' ? '' : Number(e.target.value))} /></label>;

    return <Card id="alertas-gerais" className="min-w-0 border-purple-200 bg-white text-gray-900 scroll-mt-24">
        <CardHeader className="p-4 sm:p-6"><CardTitle className="flex gap-2 items-center text-gray-900"><Bell className="w-5 h-5 shrink-0 text-purple-600" />Regras da congregação</CardTitle><CardDescription className="text-gray-600">Estas regras se aplicam à congregação. Cada pessoa vê apenas seus próprios alertas.</CardDescription></CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
            {!data ? !error && <p className="text-gray-500">Carregando configurações...</p> : <form onSubmit={save} className="space-y-5">
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <p className="font-medium text-gray-900">No sininho</p>
                        {checkbox('assignmentsEnabled', 'Próximas designações (todas as categorias)')}
                        {number('assignmentDays', 'Mostrar quantos dias antes?')}
                        {checkbox('cleaningEnabled', 'Limpeza do grupo ou como responsável')}
                        {number('cleaningDays', 'Antecedência da limpeza (dias)')}
                        {checkbox('reportsEnabled', 'Relatório do mês anterior pendente / atrasado')}
                        {number('reportDueDay', 'Dia limite para enviar o relatório', 28)}
                        <p className="text-xs text-gray-500">O alerta do relatório desaparece após o registro do envio. Designações aparecem até o dia previsto.</p>
                    </div>
                    <div className="space-y-4">
                        <p className="font-medium text-gray-900 flex items-center gap-2"><Mail className="w-4 h-4" />Lembretes automáticos por e-mail</p>
                        {checkbox('emailEnabled', 'Ativar envio automático para a congregação', !canEmail || !data.readiness.email || !data.readiness.cron)}
                        {number('emailDays', 'Enviar quantos dias antes?', 30, !canEmail)}
                        {checkbox('emailOnDay', 'Enviar também no dia da designação', !canEmail)}
                        {checkbox('emailCleaning', 'Incluir lembretes de limpeza', !canEmail)}
                        <p className="text-xs text-gray-500">Vida e Ministério, privilégios mecânicos e discursos públicos. Usa o e-mail cadastrado de cada pessoa, com suas designações daquele dia.</p>
                        <p className="text-xs text-gray-500">Rotina diária prevista para 10h (horário de Brasília), quando publicado na Vercel. A execução depende do agendador da hospedagem.</p>
                        {(!data.readiness.email || !data.readiness.cron) && <p className="text-sm text-amber-700 rounded-md bg-amber-50 p-3">O servidor ainda precisa ser configurado para habilitar os lembretes automáticos. {data.readiness.email ? '' : 'Envio de e-mail pendente. '}{data.readiness.cron ? '' : 'Agendador pendente.'}</p>}
                        <p className="text-xs text-gray-500">Envios confirmados: {data.delivery?.enviados || 0}. Falhas pendentes: {data.delivery?.falhas || 0}.</p>
                        {data.delivery?.ultimo_envio && <p className="text-xs text-gray-500">Último envio: {new Date(data.delivery.ultimo_envio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Button type="submit" className="min-h-11 w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white" disabled={!canEdit || saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar alertas</Button>
                    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
                </div>
            </form>}
        </CardContent>
    </Card>;
}
