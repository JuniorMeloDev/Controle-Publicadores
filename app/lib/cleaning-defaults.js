export function cleaningDefaultTasks(date, meetings, defaults) {
    if (!date) return '';
    const meeting = meetings.find(item => item.data.slice(0, 10) === date);
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = meeting?.tipo ? meeting.tipo === 'Fim de Semana' : day === 0 || day === 6;
    return (weekend ? defaults.fim_semana : defaults.meio_semana) || '';
}
