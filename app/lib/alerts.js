export const DEFAULT_ALERT_SETTINGS = Object.freeze({
    assignmentsEnabled: true,
    assignmentDays: 7,
    cleaningEnabled: true,
    cleaningDays: 7,
    reportsEnabled: true,
    reportDueDay: 5,
    emailEnabled: false,
    emailDays: 2,
    emailOnDay: true,
    emailCleaning: false,
});

export function validateAlertSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuração inválida.');
    const settings = { ...DEFAULT_ALERT_SETTINGS, ...value };
    for (const key of ['assignmentsEnabled', 'cleaningEnabled', 'reportsEnabled', 'emailEnabled', 'emailOnDay', 'emailCleaning']) {
        if (typeof settings[key] !== 'boolean') throw new Error('Opção de alerta inválida.');
    }
    for (const [key, min, max] of [['assignmentDays', 1, 30], ['cleaningDays', 1, 30], ['reportDueDay', 1, 28], ['emailDays', 1, 30]]) {
        if (!Number.isInteger(settings[key]) || settings[key] < min || settings[key] > max) throw new Error('Prazo de alerta inválido.');
    }
    return Object.fromEntries(Object.keys(DEFAULT_ALERT_SETTINGS).map(key => [key, settings[key]]));
}

export function dateKey(value) {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function todayInBrazil(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function daysBetween(start, end) {
    return Math.round((Date.parse(`${dateKey(end)}T00:00:00Z`) - Date.parse(`${dateKey(start)}T00:00:00Z`)) / 86400000);
}

export function previousReportPeriod(today) {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 1);
    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return { month: months[month], serviceYear: year + (month >= 8 ? 1 : 0), calendarYear: year, key: `${year}-${String(month + 1).padStart(2, '0')}` };
}

export function meaningfulAssignments(assignments) {
    // These parts are already covered by the chairman's assignment.
    return assignments.filter(a => !/^(Comentários (iniciais|finais)|Cântico\s)/i.test(a.nome_parte));
}

export function buildNotifications({ assignments, settings, today, reportPending = false }) {
    const notifications = meaningfulAssignments(assignments).flatMap(a => {
        const cleaning = a.origem === 'limpeza_semanal';
        if (!(cleaning ? settings.cleaningEnabled : settings.assignmentsEnabled)) return [];
        const date = dateKey(a.data_reuniao);
        const days = daysBetween(today, date);
        if (days < 0 || days > (cleaning ? settings.cleaningDays : settings.assignmentDays)) return [];
        return [{ id: `${a.id}:${date}:${a.nome_parte}`, title: cleaning ? 'Limpeza do seu grupo' : a.nome_parte,
            detail: cleaning ? a.descricao_semana : a.categoria, date, category: cleaning ? 'limpeza' : 'designacao',
            href: '/admin/designacoes', overdue: false }];
    });
    if (settings.reportsEnabled && reportPending) {
        const period = previousReportPeriod(today);
        const overdue = Number(today.slice(8)) > settings.reportDueDay;
        notifications.push({ id: `relatorio:${period.key}:${overdue ? 'atrasado' : 'pendente'}`,
            title: overdue ? 'Relatório mensal atrasado' : 'Relatório mensal pendente',
            detail: `${period.month}/${period.calendarYear} — prazo: dia ${settings.reportDueDay}`,
            date: today.slice(0, 8) + String(settings.reportDueDay).padStart(2, '0'),
            category: 'relatorio', href: '/relatorio-mensal', overdue });
    }
    return notifications.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function buildEmailReminders({ assignments, publishers, settings, today, retries = [] }) {
    if (!settings.emailEnabled) return [];
    const recipients = new Map(publishers.map(p => [Number(p.id), p]));
    const retryByDate = new Map(retries.map(r => [`${r.publicador_id}:${dateKey(r.data_designacao)}`, r]));
    const groups = new Map();
    for (const a of meaningfulAssignments(assignments)) {
        if (a.origem === 'limpeza_semanal' && !settings.emailCleaning) continue;
        const date = dateKey(a.data_reuniao);
        const daysUntil = daysBetween(today, date);
        const scheduled = daysUntil === settings.emailDays || (settings.emailOnDay && daysUntil === 0);
        const retry = retryByDate.get(`${a.publicador_id}:${date}`);
        if (daysUntil < 0 || (!scheduled && !retry)) continue;
        const days = scheduled ? daysUntil : Number(retry.antecedencia);
        const publisher = recipients.get(Number(a.publicador_id));
        if (!publisher?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publisher.email.trim())) continue;
        const key = `${publisher.id}:${date}:${days}`;
        if (!groups.has(key)) groups.set(key, { key, publisherId: publisher.id, email: publisher.email.trim(),
            name: publisher.nome_chamado || publisher.nome_completo, date, days, assignments: [] });
        groups.get(key).assignments.push(a);
    }
    return [...groups.values()];
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function reminderMessage(reminder) {
    const date = reminder.date.split('-').reverse().join('/');
    const parts = reminder.assignments.map(a => `${a.categoria}: ${a.nome_parte}${a.origem === 'limpeza_semanal' ? ` — ${a.descricao_semana || ''}` : ''}`);
    const intro = `Olá, ${reminder.name}! Suas designações para ${date}:`;
    return { subject: `Lembrete de designações — ${date}`, text: `${intro}\n\n${parts.join('\n')}\n\nConfira a programação no aplicativo.`,
        html: `<div style="font-family:Arial,sans-serif;color:#172554;max-width:600px;margin:auto"><h2>Lembrete de designações</h2><p>${escapeHtml(intro)}</p><ul>${parts.map(p => `<li style="margin-bottom:12px">${escapeHtml(p)}</li>`).join('')}</ul><p>Confira a programação no aplicativo.</p></div>` };
}
