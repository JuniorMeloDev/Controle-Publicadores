'use client';

import { useState } from 'react';
import { Calendar, History, Loader2, Save, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { PublisherCombobox } from '@/app/components/reunioes/PublisherCombobox';
import { PublisherSummaryModal } from '@/app/components/designacoes/PublisherSummaryModal';
import { isMechanicalTypeApplicable, isEligibleForMechanicalType } from '@/app/lib/mechanical-assignments';

const formatDate = value => String(value).slice(0, 10).split('-').reverse().join('/');

export function MechanicalWeekModal({ week, types, publishers, savedAssignments, canEdit, onClose, onSaved }) {
    const meetings = week.meetings.filter(m => !m.cancelado);
    const [draft, setDraft] = useState(() => Object.fromEntries(meetings.map(m => [m.id, { ...savedAssignments[m.id] }])));
    const [saving, setSaving] = useState(false);
    const [automatic, setAutomatic] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [publisherId, setPublisherId] = useState(null);
    const busy = saving || automatic;

    function payload() {
        return meetings.map(meeting => ({
            reuniao_id: meeting.id,
            assignments: types.map(type => ({
                tipo_id: type.id,
                publicador_id: isMechanicalTypeApplicable(type, meeting) ? draft[meeting.id]?.[type.id] || null : null
            }))
        }));
    }

    async function insertAutomatic() {
        if (!canEdit || busy) return;
        setAutomatic(true);
        setError('');
        setNotice('');
        try {
            const assignments = payload().flatMap(m => m.assignments.map(a => ({ ...a, reuniao_id: m.reuniao_id })));
            const response = await fetch('/api/admin/privilegios/sugestoes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ semana: week.start, reuniao_ids: meetings.map(m => m.id), assignments })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Não foi possível preencher automaticamente.');
            setDraft(previous => {
                const next = Object.fromEntries(Object.entries(previous).map(([id, values]) => [id, { ...values }]));
                for (const assignment of data.assignments) next[assignment.reuniao_id][assignment.tipo_id] = assignment.publicador_id;
                return next;
            });
            setNotice(data.unfilled.length
                ? `Sugestões inseridas. ${data.unfilled.length} campo(s) ficaram vazios por falta de candidatos disponíveis sem repetir pessoas na semana. Você pode preenchê-los manualmente.`
                : 'Sugestões inseridas. Confira as designações e clique em Salvar semana.');
        } catch (err) {
            setError(err.message);
        } finally {
            setAutomatic(false);
        }
    }

    async function save() {
        if (!canEdit || busy) return;
        setSaving(true);
        setError('');
        const rows = payload();
        try {
            const response = await fetch('/api/admin/privilegios/atribuicoes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reunioes: rows })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Não foi possível salvar a semana.');
            onSaved(rows);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <Dialog open onOpenChange={open => !open && !busy && onClose()}>
                <DialogContent className="bg-white text-gray-900 w-[calc(100%-2rem)] max-w-4xl sm:max-w-4xl max-h-[90dvh] flex flex-col p-0 gap-0 rounded-xl overflow-hidden">
                    <DialogHeader className="px-5 py-5 pr-12 border-b text-left shrink-0">
                        <DialogTitle className="flex items-center gap-2"><Calendar className="text-purple-600 w-5 h-5 shrink-0" /> Privilégios Mecânicos</DialogTitle>
                        <DialogDescription>Semana de {formatDate(week.start)} a {formatDate(week.end)}</DialogDescription>
                    </DialogHeader>
                    <div className="px-5 py-4 border-b bg-purple-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                        <p className="text-xs text-gray-600 max-w-lg">O automático preenche os campos vazios, priorizando quem está há mais tempo sem designação. As escolhas já feitas são mantidas.</p>
                        <Button variant="outline" onClick={insertAutomatic} disabled={!canEdit || busy || !types.length} className="gap-2 shrink-0 border-purple-200 text-purple-700">
                            {automatic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Inserir automático
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
                        {error && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}
                        {notice && <p role="status" className="p-3 rounded-lg bg-purple-50 text-purple-700 text-sm">{notice}</p>}
                        {week.meetings.filter(m => m.cancelado).map(meeting => <p key={meeting.id} className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">{formatDate(meeting.data)}: {meeting.motivo_cancelamento || 'Reunião cancelada'}</p>)}
                        {!types.length && <p className="text-sm text-gray-500">Cadastre um tipo de privilégio para inserir designações.</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {meetings.map(meeting => (
                                <section key={meeting.id} className="border border-gray-200 rounded-xl p-4 space-y-4 min-w-0">
                                    <div className="border-b pb-3">
                                        <h3 className="font-semibold text-gray-900">{meeting.tipo}</h3>
                                        <p className="text-sm text-purple-600 mt-1">{formatDate(meeting.data)} · {new Date(meeting.data + 'T00:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })}</p>
                                    </div>
                                    {types.filter(type => isMechanicalTypeApplicable(type, meeting)).map(type => {
                                        const selectedId = draft[meeting.id]?.[type.id];
                                        const candidates = publishers.filter(p => isEligibleForMechanicalType(p, type) || p.id === selectedId);
                                        return (
                                            <div key={type.id} className="space-y-1">
                                                <PublisherCombobox label={type.nome} publishers={candidates} value={selectedId}
                                                    disabled={!canEdit || busy}
                                                    onChange={value => {
                                                        setDraft(previous => ({ ...previous, [meeting.id]: { ...previous[meeting.id], [type.id]: value } }));
                                                        setNotice('');
                                                    }} />
                                                {selectedId && <button type="button" onClick={() => setPublisherId(selectedId)} className="text-xs text-purple-600 hover:underline flex items-center gap-1 py-1">
                                                    <History size={12} /> Ver designações futuras
                                                </button>}
                                            </div>
                                        );
                                    })}
                                </section>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="px-5 py-4 border-t bg-gray-50 gap-2 shrink-0">
                        <Button variant="outline" onClick={onClose} disabled={busy}>{canEdit ? 'Cancelar' : 'Fechar'}</Button>
                        {canEdit && <Button onClick={save} disabled={busy || !types.length} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar semana
                        </Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <PublisherSummaryModal publisherId={publisherId} isOpen={Boolean(publisherId)} onClose={() => setPublisherId(null)} />
        </>
    );
}
