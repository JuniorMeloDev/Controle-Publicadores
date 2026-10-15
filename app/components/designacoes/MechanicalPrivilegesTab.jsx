'use client';

import { StatusToast } from '@/app/components/ui/status-toast';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChevronDown, ChevronRight, Loader2, Settings } from 'lucide-react';
import { DesignationRowActions } from './DesignationRowActions';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';
import { writeMechanicalPdf } from '@/app/lib/mechanical-pdf';
import { mechanicalWeekMessage } from '@/app/lib/designation-share';
import { Button } from '@/app/components/ui/button';
import { PrivilegeTypesModal } from '@/app/components/designacoes/PrivilegeTypesModal';
import { MechanicalWeekModal } from '@/app/components/designacoes/MechanicalWeekModal';
import { usePermissions } from '@/app/components/PermissionsContext';
import { isAllowed } from '@/app/lib/access-control';
import { useDesignationPeriod } from './DesignationPeriodContext';
import { DesignationPeriodFilters, designationToolbarClass, designationActionClass, designationListHeaderClass } from './DesignationLayout';
import { addDateDays, getWeekStart, isMechanicalTypeApplicable } from '@/app/lib/mechanical-assignments';

export const formatMechanicalDate = value => String(value).slice(0, 10).split('-').reverse().join('/');

export function MechanicalPrivilegesTab() {
    const { permissions } = usePermissions();
    const canEdit = isAllowed(permissions, 'privilegios_mecanicos_editar', 'actions');
    const [meetings, setMeetings] = useState([]);
    const [publishers, setPublishers] = useState([]);
    const [types, setTypes] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { month, year } = useDesignationPeriod();
    const [typesOpen, setTypesOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [expandedWeek, setExpandedWeek] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            setError('');
            try {
                const responses = await Promise.all([
                    fetch('/api/admin/reunioes?all=1', { signal: controller.signal }),
                    fetch('/api/admin/get-publicadores', { signal: controller.signal }),
                    fetch('/api/admin/privilegios/tipos', { signal: controller.signal })
                ]);
                if (responses.some(r => !r.ok)) throw new Error('Não foi possível carregar as reuniões e os publicadores.');
                const [meetingData, publisherData, typeData] = await Promise.all(responses.map(r => r.json()));
                const realMeetings = meetingData.filter(m => m.id && !m.virtual).map(m => ({
                    ...m, data: m.data.slice(0, 10)
                })).sort((a, b) => a.data.localeCompare(b.data));
                const ids = realMeetings.map(m => m.id);
                const assignmentMap = {};
                if (ids.length) {
                    const response = await fetch('/api/admin/privilegios/atribuicoes?reuniao_ids=' + ids.join(','), { signal: controller.signal });
                    if (!response.ok) throw new Error('Não foi possível carregar as designações.');
                    for (const row of await response.json()) {
                        assignmentMap[row.reuniao_id] ||= {};
                        assignmentMap[row.reuniao_id][row.privilegio_tipo_id] = row.publicador_id;
                    }
                }
                if (!controller.signal.aborted) {
                    setMeetings(realMeetings);
                    setPublishers(publisherData);
                    setTypes(typeData.filter(t => t.ativo));
                    setAssignments(assignmentMap);
                }
            } catch (err) {
                if (!controller.signal.aborted) setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        load();
        return () => controller.abort();
    }, [reload]);

    const weeks = useMemo(() => {
        const groups = new Map();
        for (const meeting of meetings) {
            const start = getWeekStart(meeting.data);
            if (!groups.has(start)) groups.set(start, { start, end: addDateDays(start, 6), meetings: [] });
            groups.get(start).meetings.push(meeting);
        }
        return [...groups.values()].filter(week => week.meetings.some(meeting =>
            (!year || meeting.data.slice(0, 4) === year) && (!month || meeting.data.slice(5, 7) === month)));
    }, [meetings, month, year]);
    const years = [...new Set([String(new Date().getFullYear()), ...meetings.map(m => m.data.slice(0, 4))])].sort().reverse();

    async function deleteWeek(week) {
        const ids = week.meetings.filter(m => !m.cancelado).map(m => m.id);
        const response = await fetch('/api/admin/privilegios/atribuicoes?reuniao_ids=' + ids.join(','), { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setAssignments(prev => { const next = { ...prev }; for (const id of ids) delete next[id]; return next; });
        setSuccess(result.message);
        window.dispatchEvent(new Event('designacoes-atualizadas'));
    }

    function handleSaved(rows) {
        setAssignments(previous => {
            const next = { ...previous };
            for (const row of rows) {
                next[row.reuniao_id] = { ...next[row.reuniao_id] };
                for (const assignment of row.assignments) next[row.reuniao_id][assignment.tipo_id] = assignment.publicador_id;
            }
            return next;
        });
        setSelectedWeek(null);
        setSuccess('Designações da reunião salvas com sucesso.');
        window.dispatchEvent(new Event('designacoes-atualizadas'));
    }

    return (
        <div className="w-full min-w-0 space-y-4">
            <div className={designationToolbarClass}>
                <div className="flex-1 min-w-0 basis-64">
                    <h2 className="text-lg font-bold text-gray-900">Privilégios Mecânicos</h2>
                    <p className="text-sm text-gray-500 mt-1">Escolha uma semana para organizar as designações das reuniões.</p>
                </div>
                <Button variant="outline" disabled={!canEdit} onClick={() => setTypesOpen(true)} className={designationActionClass}>
                    <Settings className="w-4 h-4" /> Tipos de privilégios
                </Button>
            </div>
            {!canEdit && <p className="text-sm text-gray-600 bg-gray-50 border rounded-lg p-3">Você pode consultar as designações, mas não tem permissão para editá-las.</p>}
            <StatusToast message={success} type="success" onClose={() => setSuccess('')} />
            {error && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <span>{error}</span><Button variant="outline" size="sm" onClick={() => setReload(value => value + 1)}>Tentar novamente</Button>
            </div>}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className={designationListHeaderClass}>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Calendar size={20} className="text-purple-600" /> Semanas de reuniões</h3>
                    <DesignationPeriodFilters years={years} />
                </div>
                {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" aria-label="Carregando semanas" /></div>
                    : !weeks.length ? <div className="flex flex-col items-center py-16 text-gray-500 gap-3"><AlertCircle className="text-gray-300" size={36} /><p>Nenhuma semana encontrada com os filtros atuais.</p></div>
                    : <div className="divide-y divide-gray-100">
                        {weeks.map(week => {
                            const activeMeetings = week.meetings.filter(m => !m.cancelado);
                            const total = activeMeetings.reduce((count, m) => count + types.filter(t => isMechanicalTypeApplicable(t, m)).length, 0);
                            const filled = activeMeetings.reduce((count, m) => count + types.filter(t => isMechanicalTypeApplicable(t, m) && assignments[m.id]?.[t.id]).length, 0);
                            return (
                                <div key={week.start}>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0 hover:bg-purple-50">
                                <button type="button" disabled={!activeMeetings.length}
                                    onClick={() => setExpandedWeek(previous => previous === week.start ? null : week.start)}
                                    aria-expanded={expandedWeek === week.start} aria-controls={`mechanical-week-${week.start}`}
                                    className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-purple-50 focus-visible:outline-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-4 group">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"><Calendar size={20} /></div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 group-hover:text-purple-700">Semana de {formatMechanicalDate(week.start)} a {formatMechanicalDate(week.end)}</p>
                                            <p className="text-xs text-gray-500 mt-1">{activeMeetings.map(m => formatMechanicalDate(m.data) + ' · ' + m.tipo).join(' / ') || 'Reuniões canceladas'}</p>
                                            {week.meetings.some(m => m.cancelado) && <p className="text-xs text-amber-700 mt-1">Há reunião cancelada nesta semana.</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                                        <span className={`text-xs px-2 py-1 rounded-full ${filled === total && total > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{filled}/{total}</span>
                                        <ChevronDown size={20} className={`text-gray-400 group-hover:text-purple-600 transition-transform ${expandedWeek === week.start ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                {filled > 0 && <div className="px-4 pb-3 sm:pb-0"><DesignationRowActions
                                    label={`Semana de ${formatMechanicalDate(week.start)}`}
                                    message={mechanicalWeekMessage(week, types, assignments, publishers, isMechanicalTypeApplicable)} buildPdf={doc => writeMechanicalPdf(doc, { week, types, assignments, publishers })} filename={`privilegios-${week.start}`}
                                    canPdf={isAllowed(permissions, 'designacoes_pdf', 'actions')}
                                    onDelete={canEdit ? () => setPendingDelete(week) : undefined} /></div>}
                                </div>
                                {expandedWeek === week.start && <div id={`mechanical-week-${week.start}`} className="border-t border-gray-200 bg-gray-50 px-3 py-2 sm:px-5">
                                    {week.meetings.map(meeting => {
                                        const scope = { ...week, meetings: [meeting] };
                                        const applicable = types.filter(t => isMechanicalTypeApplicable(t, meeting));
                                        const count = applicable.filter(t => assignments[meeting.id]?.[t.id]).length;
                                        return <div key={meeting.id} className="my-2 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white sm:flex-row sm:items-center">
                                            <button type="button" disabled={meeting.cancelado} onClick={() => { setSuccess(''); setSelectedWeek(scope); }}
                                                aria-label={`Abrir ${meeting.tipo} de ${formatMechanicalDate(meeting.data)}`}
                                                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-purple-50 disabled:opacity-50 focus-visible:outline-purple-500">
                                                <span><span className="block font-semibold text-gray-900">{meeting.tipo}</span><span className="mt-1 block text-sm text-gray-500">{formatMechanicalDate(meeting.data)}</span>
                                                <span className={`mt-1 block text-xs ${meeting.cancelado ? 'text-red-600' : 'text-purple-600'}`}>{meeting.cancelado ? meeting.motivo_cancelamento || 'Reunião cancelada' : `${count}/${applicable.length} privilégios preenchidos`}</span></span>
                                                {!meeting.cancelado && <ChevronRight size={18} className="shrink-0 text-gray-400" />}
                                            </button>
                                            {!meeting.cancelado && <div className="px-4 pb-3 sm:pb-0"><DesignationRowActions
                                                label={`${meeting.tipo} de ${formatMechanicalDate(meeting.data)}`}
                                                message={mechanicalWeekMessage(scope, types, assignments, publishers, isMechanicalTypeApplicable)}
                                                buildPdf={doc => writeMechanicalPdf(doc, { week: scope, types, assignments, publishers })}
                                                filename={`privilegios-${meeting.data}-${meeting.id}`} canPdf={isAllowed(permissions, 'designacoes_pdf', 'actions')}
                                                onDelete={canEdit && count > 0 ? () => setPendingDelete(scope) : undefined} /></div>}
                                        </div>;
                                    })}
                                </div>}
                                </div>
                            );
                        })}
                    </div>}
            </div>
            {pendingDelete && <ConfirmationDialog destructive title={pendingDelete.meetings.length === 1 ? 'Excluir os privilégios desta reunião?' : 'Excluir os privilégios da semana?'} confirmLabel="Excluir"
                description={`As pessoas designadas para ${pendingDelete.meetings.filter(m => !m.cancelado).map(m => `${m.tipo} em ${formatMechanicalDate(m.data)}`).join(' e ')} serão removidas. As reuniões continuarão no calendário.`}
                onConfirm={() => deleteWeek(pendingDelete)} onCancel={() => setPendingDelete(null)} />}
            <PrivilegeTypesModal open={typesOpen} onOpenChange={setTypesOpen} onUpdate={() => setReload(value => value + 1)} />
            {selectedWeek && <MechanicalWeekModal key={selectedWeek.meetings.map(m => m.id).join('-')} week={selectedWeek}
                types={types} publishers={publishers} savedAssignments={assignments} canEdit={canEdit}
                onClose={() => setSelectedWeek(null)} onSaved={handleSaved} />}
        </div>
    );
}
