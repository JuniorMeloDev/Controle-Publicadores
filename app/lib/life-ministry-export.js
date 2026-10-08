export const meetingExportKey = meeting => meeting.id || meeting.dataSQL;
export const canExportMeeting = meeting => meeting.tem_programacao !== false && !meeting.cancelado;

export async function fetchLifeMinistryExportDetails(meetings, selectedIds, fetcher = fetch) {
    const selected = meetings.filter(meeting => selectedIds.has(meetingExportKey(meeting)))
        .sort((a, b) => a.dataSQL.localeCompare(b.dataSQL));
    if (!selected.length) throw new Error('Selecione pelo menos uma reunião com programação disponível.');
    const results = [];
    for (const meeting of selected) {
        const date = meeting.dataSQL.split('-').reverse().join('/');
        if (!canExportMeeting(meeting)) throw new Error(`A reunião de ${date} está cancelada ou ainda não possui programação para exportar.`);
        const response = await fetcher(`/api/admin/get-meeting-details?date=${encodeURIComponent(meeting.dataSQL)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) throw new Error('Sua sessão expirou. Entre novamente para exportar.');
            const reason = response.status === 404 ? 'Programação não encontrada. Importe a programação antes de exportar.' : data.message || data.error || 'Não foi possível carregar a programação.';
            throw new Error(`Reunião de ${date}: ${reason}`);
        }
        if (!data.schedule || typeof data.schedule !== 'object') throw new Error(`A programação da reunião de ${date} está inválida. Importe-a novamente antes de exportar.`);
        results.push({ ...data, assignments: data.assignments || {}, weekDescription: data.weekDescription || meeting.descricao || date });
    }
    return results;
}
