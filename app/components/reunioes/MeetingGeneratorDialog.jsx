'use client';

import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';

export function MeetingGeneratorDialog({ year, month, onCreated }) {
    const { permissions } = usePermissions();
    const canCreate = isAllowed(permissions, 'configuracoes_editar', 'actions');
    const [open, setOpen] = useState(false);
    const [period, setPeriod] = useState('');
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState('');

    async function generate(action) {
        setBusy(true);
        setError('');
        try {
            const [selectedYear, selectedMonth] = period.split('-');
            const response = await fetch('/api/admin/reunioes/gerar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, period: 'mes_especifico', year: Number(selectedYear), month: Number(selectedMonth),
                    options: action === 'create' ? { meetings_to_create: preview.meetings.filter(m => !m.exists) } : undefined })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Não foi possível gerar as reuniões.');
            if (action === 'preview') setPreview(data);
            else {
                setResult(data.message);
                setPreview(null);
                await onCreated(selectedYear, selectedMonth);
            }
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    const newMeetings = preview?.meetings.filter(m => !m.exists) || [];
    const midweek = newMeetings.filter(m => m.tipo === 'Meio de Semana').length;
    return <>
        <Button disabled={!canCreate} onClick={() => {
            setPeriod(`${year}-${String(month).padStart(2, '0')}`);
            setPreview(null); setError(''); setResult(''); setOpen(true);
        }} className="bg-purple-600 hover:bg-purple-700 text-white gap-2"><Calendar size={16} /> Gerar reuniões do mês</Button>
        <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
            <DialogContent className="bg-white text-gray-900 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Gerar reuniões e preparar designações</DialogTitle></DialogHeader>
                <label className="text-sm font-medium">Mês e ano
                    <input aria-label="Mês e ano da geração" type="month" value={period} disabled={busy}
                        onChange={e => { setPeriod(e.target.value); setPreview(null); setResult(''); }} className="block w-full mt-2 border rounded-md p-2" />
                </label>
                <p className="text-sm text-gray-500">As datas seguem os dias configurados e os eventos especiais. As quatro abas de designações receberão as reuniões automaticamente.</p>
                {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-md">{error}</p>}
                {result && <p role="status" className="bg-green-50 text-green-700 p-3 rounded-md">{result}</p>}
                {preview && <div className="space-y-3">
                    <p className="text-sm font-medium">{newMeetings.length} novas reuniões · {preview.meetings.length - newMeetings.length} já existentes</p>
                    <p className="text-sm text-purple-700 bg-purple-50 rounded-md p-3">
                        Vida e Ministério: {midweek} · Discursos Públicos: {newMeetings.length - midweek}<br />
                        Privilégios Mecânicos: {newMeetings.length} · Limpeza: {newMeetings.length}
                    </p>
                    {preview.warnings.map((warning, i) => <p key={i} className="text-xs text-amber-800">{warning}</p>)}
                    <ul className="max-h-60 overflow-y-auto divide-y border rounded-md">
                        {preview.meetings.map(m => <li key={m.data} className="p-3 text-sm flex justify-between gap-3">
                            <span>{m.data.split('-').reverse().join('/')} · {m.tipo}</span>
                            <span className={m.exists ? 'text-gray-500' : 'text-green-700'}>{m.exists ? 'Já existe' : 'Nova'}</span>
                        </li>)}
                    </ul>
                    {!preview.meetings.length && <p className="text-sm text-gray-500">Nenhuma reunião prevista para o período.</p>}
                </div>}
                <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Fechar</Button>
                    <Button disabled={busy || !period || (Boolean(preview) && !newMeetings.length) || Boolean(result)} onClick={() => generate(preview ? 'create' : 'preview')} className="bg-purple-600 text-white">
                        {busy ? <Loader2 className="animate-spin" size={16} /> : preview ? 'Confirmar e criar' : 'Gerar prévia'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}
