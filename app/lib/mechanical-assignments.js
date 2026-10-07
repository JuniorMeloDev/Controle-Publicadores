export function getWeekStart(value) {
    const date = new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0, 10);
}

export function addDateDays(value, days) {
    const date = new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function isMechanicalTypeApplicable(type, meeting) {
    // The Watchtower reader is only assigned at the weekend meeting.
    const name = normalize(type.nome);
    return !(name.includes('leitor') && name.includes('sentinela') && meeting.tipo !== 'Fim de Semana');
}

export function isEligibleForMechanicalType(publisher, type) {
    if (normalize(type.nome).includes('anciao')) return publisher.privilegios?.includes('anciao') || false;
    return publisher.sexo === 'Masculino' && Boolean(publisher.data_batismo);
}

export function suggestMechanicalAssignments({ meetings, types, publishers, history, assignments = [] }) {
    const meetingIds = new Set(meetings.map(m => String(m.id)));
    const week = getWeekStart(meetings[0].data);
    const nextWeek = addDateDays(week, 7);
    const result = assignments.filter(a => meetingIds.has(String(a.reuniao_id))).map(a => ({ ...a }));
    const used = new Set(result.filter(a => a.publicador_id).map(a => String(a.publicador_id)));
    const lastAssigned = new Map();

    for (const entry of history) {
        const date = new Date(entry.data_reuniao).toISOString().slice(0, 10);
        const id = String(entry.publicador_id);
        if (entry.origem === 'privilegios_mecanicos' && meetingIds.has(String(entry.reuniao_id))) continue;
        if (date >= week && date < nextWeek) used.add(id);
        if (date < week && date > (lastAssigned.get(id) || '')) lastAssigned.set(id, date);
    }

    const slots = meetings.flatMap(meeting => types
        .filter(type => type.ativo !== false && isMechanicalTypeApplicable(type, meeting))
        .filter(type => !result.some(a => String(a.reuniao_id) === String(meeting.id) && String(a.tipo_id) === String(type.id) && a.publicador_id))
        .map(type => ({ meeting, type, candidates: publishers.filter(p => isEligibleForMechanicalType(p, type)) })));
    // Allocate constrained roles first, so general roles cannot consume every elder.
    slots.sort((a, b) => a.candidates.length - b.candidates.length || new Date(a.meeting.data) - new Date(b.meeting.data) || a.type.ordem - b.type.ordem);

    const unfilled = [];
    for (const { meeting, type, candidates } of slots) {
        const available = candidates.filter(p => !used.has(String(p.id)));
        available.sort((a, b) =>
            (lastAssigned.get(String(a.id)) || '').localeCompare(lastAssigned.get(String(b.id)) || '') ||
            a.nome_completo.localeCompare(b.nome_completo, 'pt-BR') || Number(a.id) - Number(b.id));
        if (!available.length) {
            unfilled.push({ reuniao_id: meeting.id, tipo_id: type.id, nome: type.nome });
            continue;
        }
        const selected = available[0];
        const slot = result.find(a => String(a.reuniao_id) === String(meeting.id) && String(a.tipo_id) === String(type.id));
        if (slot) slot.publicador_id = selected.id;
        else result.push({ reuniao_id: meeting.id, tipo_id: type.id, publicador_id: selected.id });
        used.add(String(selected.id));
    }
    return { assignments: result, unfilled };
}
