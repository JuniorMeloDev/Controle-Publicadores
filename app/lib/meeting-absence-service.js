import { addCalendarDays, dateOnly, meetingCancellation } from './meeting-calendar.js';
import { absenceMessage } from './meeting-absence.js';

export async function ensureAbsenceTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS assistencia_registros_salvos (
            reuniao_id INTEGER PRIMARY KEY REFERENCES reunioes_registro(id) ON DELETE CASCADE,
            salvo_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS assistencia_email_envios (
            reuniao_id INTEGER REFERENCES reunioes_registro(id) ON DELETE CASCADE,
            publicador_id INTEGER REFERENCES publicadores(id) ON DELETE CASCADE,
            status TEXT NOT NULL, tentativas INTEGER NOT NULL DEFAULT 1,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), enviado_em TIMESTAMPTZ,
            PRIMARY KEY (reuniao_id, publicador_id)
        );
    `);
}

export async function getAbsenceRecipients(client) {
    const { rows } = await client.query(`SELECT p.id, p.nome_completo, p.email FROM publicadores p
        LEFT JOIN grupos g ON g.id = p.grupo_id
        WHERE (g.id IS NULL OR g.ativo = TRUE) AND NULLIF(trim(p.email), '') IS NOT NULL
        ORDER BY p.nome_completo`);
    return rows.filter(p => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()));
}

export async function deliverAbsenceEmails(client, { settings, today, sendMail }) {
    const totals = { sent: 0, failed: 0, skipped: 0 };
    if (!settings.absenceEmailEnabled || !settings.absenceRecipientIds?.length) return totals;
    await ensureAbsenceTables(client);
    const yesterday = addCalendarDays(today, -1);
    // New reports are only created the next day. Pending SMTP failures may retry for seven days.
    const { rows: meetings } = await client.query(`SELECT r.*, r.data::text AS data FROM reunioes_registro r
        WHERE (r.data = $1::date OR (r.data >= $1::date - 6 AND r.data < $1::date AND EXISTS (
            SELECT 1 FROM assistencia_email_envios e WHERE e.reuniao_id = r.id AND
            (e.status = 'falhou' OR (e.status = 'processando' AND e.atualizado_em < NOW() - INTERVAL '15 minutes'))
        ))) AND EXISTS (SELECT 1 FROM assistencia_registros_salvos s WHERE s.reuniao_id = r.id)
        ORDER BY r.data`, [yesterday]);
    if (!meetings.length) return totals;
    const { rows: events } = await client.query('SELECT data, tipo, nome FROM eventos_especiais WHERE data BETWEEN $1::date - 7 AND $2::date + 7', [addCalendarDays(yesterday, -6), yesterday]);
    const { rows: configs } = await client.query('SELECT ano, dia_fim_semana FROM configuracoes_gerais');
    const recipients = (await getAbsenceRecipients(client)).filter(p => settings.absenceRecipientIds.includes(Number(p.id)));
    for (const meeting of meetings) {
        if (meetingCancellation(meeting, events, configs.find(c => String(c.ano) === dateOnly(meeting.data).slice(0, 4))).cancelado) continue;
        const { rows: absent } = await client.query(`SELECT p.nome_completo, g.nome_grupo FROM publicadores p
            LEFT JOIN grupos g ON g.id = p.grupo_id
            WHERE (g.id IS NULL OR g.ativo = TRUE) AND NOT EXISTS (
                SELECT 1 FROM assistencia_detalhe a WHERE a.reuniao_id = $1 AND a.publicador_id = p.id
                AND a.modalidade IN ('Presencial', 'Zoom')
            ) ORDER BY g.nome_grupo NULLS LAST, p.nome_completo`, [meeting.id]);
        const message = absenceMessage(meeting, absent);
        for (const recipient of recipients) {
            // Never start a fresh delivery for an old meeting, even if recipients changed.
            const claim = await client.query(`INSERT INTO assistencia_email_envios (reuniao_id, publicador_id, status)
                SELECT $1, $2, 'processando' WHERE $3::boolean OR EXISTS (
                    SELECT 1 FROM assistencia_email_envios WHERE reuniao_id = $1 AND publicador_id = $2)
                ON CONFLICT (reuniao_id, publicador_id) DO UPDATE SET status = 'processando',
                    tentativas = assistencia_email_envios.tentativas + 1, atualizado_em = NOW()
                WHERE assistencia_email_envios.status = 'falhou' OR (assistencia_email_envios.status = 'processando'
                    AND assistencia_email_envios.atualizado_em < NOW() - INTERVAL '15 minutes')
                RETURNING reuniao_id`, [meeting.id, recipient.id, dateOnly(meeting.data) === yesterday]);
            if (!claim.rows.length) { totals.skipped++; continue; }
            try {
                const result = await sendMail({ to: recipient.email.trim(), ...message });
                if (result?.rejected?.length) throw new Error('Destinatário recusado.');
            } catch {
                await client.query("UPDATE assistencia_email_envios SET status = 'falhou', atualizado_em = NOW() WHERE reuniao_id = $1 AND publicador_id = $2", [meeting.id, recipient.id]);
                totals.failed++;
                continue;
            }
            await client.query("UPDATE assistencia_email_envios SET status = 'enviado', enviado_em = NOW(), atualizado_em = NOW() WHERE reuniao_id = $1 AND publicador_id = $2", [meeting.id, recipient.id]);
            totals.sent++;
        }
    }
    return totals;
}
