// Calendar dates are civil dates in São Paulo; arithmetic uses UTC to avoid DST offsets.
export const dateOnly = value => typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);

export function addCalendarDays(value, days) {
    const date = new Date(`${dateOnly(value)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function calendarWeekStart(value) {
    const date = new Date(`${dateOnly(value)}T00:00:00Z`);
    return addCalendarDays(value, -((date.getUTCDay() + 6) % 7));
}

export function isCalendarDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && dateOnly(new Date(`${value}T00:00:00Z`)) === value;
}

export function generationRange({ period, year, month, today }) {
    const current = new Date(`${today}T00:00:00Z`);
    const selectedYear = Number(year);
    if (!Number.isInteger(selectedYear) || selectedYear < 2000 || selectedYear > 2100) throw new Error('Ano inválido.');
    if (period === 'mes_especifico') {
        const selectedMonth = Number(month);
        if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) throw new Error('Selecione um mês válido.');
        return {
            start: dateOnly(new Date(Date.UTC(selectedYear, selectedMonth - 1, 1))),
            end: dateOnly(new Date(Date.UTC(selectedYear, selectedMonth, 0)))
        };
    }
    if (!['mensal', 'trimestral', 'semestral', 'anual'].includes(period)) throw new Error('Período inválido.');
    if (selectedYear < current.getUTCFullYear()) throw new Error('O ano selecionado já passou.');
    if (period === 'anual') return {
        start: selectedYear > current.getUTCFullYear() ? `${selectedYear}-01-01` : addCalendarDays(today, 1),
        end: `${selectedYear}-12-31`
    };
    const start = selectedYear > current.getUTCFullYear()
        ? new Date(Date.UTC(selectedYear, 0, 1))
        : new Date(Date.UTC(selectedYear, current.getUTCMonth() + 1, 1));
    const count = { mensal: 1, trimestral: 3, semestral: 6 }[period];
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + count, 0));
    // December's next month is January of the following year, using that year's configuration.
    return { start: dateOnly(start), end: dateOnly(end) };
}

export function meetingCancellation(meeting, events, config) {
    if (meeting.cancelada) return { cancelado: true, motivo_cancelamento: meeting.motivo_cancelamento || 'Reunião cancelada.', evento_nome: '' };
    const date = dateOnly(meeting.data);
    const start = calendarWeekStart(date);
    const end = addCalendarDays(start, 6);
    const onDay = events.find(e => dateOnly(e.data) === date && e.tipo !== 'Visita do Superintendente');
    let conflict = onDay;
    let reason = onDay ? `${onDay.tipo}: ${onDay.nome}` : '';
    if (!conflict && meeting.tipo === 'Meio de Semana') {
        const weekEvents = events.filter(e => dateOnly(e.data) >= start && dateOnly(e.data) <= end);
        const visit = weekEvents.find(e => e.tipo === 'Visita do Superintendente');
        if (visit && date !== addCalendarDays(start, 1)) {
            conflict = visit;
            reason = 'Semana de visita: reunião transferida para terça-feira.';
        }
        if (!conflict) {
            conflict = weekEvents.find(e => ['Celebração', 'Assembleia', 'Congresso'].includes(e.tipo));
            if (conflict) reason = `${conflict.tipo} na semana: ${conflict.nome}`;
        }
        if (!conflict && config) {
            const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            for (let offset = 1; offset <= 6; offset++) {
                const next = addCalendarDays(date, offset);
                if (days[new Date(`${next}T00:00:00Z`).getUTCDay()] !== config.dia_fim_semana) continue;
                conflict = events.find(e => dateOnly(e.data) === next && ['Assembleia', 'Congresso'].includes(e.tipo));
                if (conflict) reason = `Antecede ${conflict.tipo}: ${conflict.nome}`;
                break;
            }
        }
    }
    return { cancelado: Boolean(conflict), motivo_cancelamento: reason, evento_nome: conflict?.nome || '' };
}

// The RTF heading describes a week, not the congregation's meeting day.
export function resolveProgramMeeting(weekText, year, meetings) {
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const text = String(weekText).toLowerCase();
    const match = text.match(/(\d{1,2})(?:\s+de\s+([a-zç]+))?\s*(?:a|-)\s*\d{1,2}\s+de\s+([a-zç]+)/);
    if (!match) throw new Error('Não foi possível identificar a semana do arquivo.');
    const monthIndex = months.indexOf(match[2] || match[3]);
    const explicitYear = text.match(/\b(\d{4})\b/);
    const calendarYear = Number(explicitYear?.[1] || year);
    const startDate = `${calendarYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
    if (!isCalendarDate(startDate)) throw new Error('Selecione o ano correto da programação.');
    const start = calendarWeekStart(startDate);
    const candidates = meetings.filter(m => m.tipo === 'Meio de Semana' && !m.cancelado && !m.cancelada &&
        dateOnly(m.data) >= start && dateOnly(m.data) <= addCalendarDays(start, 6));
    if (candidates.length !== 1) throw new Error(candidates.length
        ? 'Há mais de uma reunião de meio de semana nesta semana. Revise o calendário.'
        : 'Não há reunião ativa para esta semana. Crie as reuniões no calendário antes de importar.');
    return candidates[0];
}
