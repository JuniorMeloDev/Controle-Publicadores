import { dateOnly, meetingCancellation } from '@/app/lib/meeting-calendar';

export async function getCalendarContext(client) {
    const [configs, events] = await Promise.all([
        client.query('SELECT ano, dia_meio_semana, dia_fim_semana FROM configuracoes_gerais'),
        client.query('SELECT data, tipo, nome FROM eventos_especiais')
    ]);
    return { configs: new Map(configs.rows.map(c => [String(c.ano), c])), events: events.rows };
}

export function withCalendarState(meeting, context) {
    return { ...meeting, data: dateOnly(meeting.data),
        ...meetingCancellation(meeting, context.events, context.configs.get(dateOnly(meeting.data).slice(0, 4))) };
}

export async function lockAssignmentMeeting(client, id, type) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error('Reunião inválida.');
    const res = await client.query('SELECT * FROM reunioes_registro WHERE id = $1 FOR UPDATE', [id]);
    if (!res.rows.length || (type && res.rows[0].tipo !== type)) throw new Error('Reunião não encontrada ou incompatível com esta designação.');
    const meeting = withCalendarState(res.rows[0], await getCalendarContext(client));
    if (meeting.cancelado) throw new Error(`Esta reunião está cancelada: ${meeting.motivo_cancelamento}`);
    return meeting;
}
