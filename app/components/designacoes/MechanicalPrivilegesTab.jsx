'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChevronRight, Loader2, Settings } from 'lucide-react';
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
        setSuccess('Designações da semana salvas com sucesso.');
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
            {success && <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{success}</p>}
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
                                <button key={week.start} type="button" disabled={!activeMeetings.length}
                                    onClick={() => { setSuccess(''); setSelectedWeek(week); }}
                                    className="w-full text-left px-4 py-3 hover:bg-purple-50 focus-visible:outline-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-4 group">
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
                                        <ChevronRight size={20} className="text-gray-400 group-hover:text-purple-600" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>}
            </div>
            <PrivilegeTypesModal open={typesOpen} onOpenChange={setTypesOpen} onUpdate={() => setReload(value => value + 1)} />
            {selectedWeek && <MechanicalWeekModal key={selectedWeek.start} week={selectedWeek}
                types={types} publishers={publishers} savedAssignments={assignments} canEdit={canEdit}
                onClose={() => setSelectedWeek(null)} onSaved={handleSaved} />}
        </div>
    );
}
