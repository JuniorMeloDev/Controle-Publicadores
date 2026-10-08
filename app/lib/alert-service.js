import { getPublisherAssignments } from './publisher-assignments';
import { findVisitInWeek, getVisitTuesday } from './meeting-visits';
import { meetingCancellation } from './meeting-calendar';
import { DEFAULT_ALERT_SETTINGS, dateKey, previousReportPeriod, buildNotifications } from './alerts';

export async function ensureAlertTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS alertas_configuracao (
            id INTEGER PRIMARY KEY CHECK (id = 1), dados JSONB NOT NULL,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS alertas_lidos (
            -- Read state is independent of each user's email preference.
            publicador_id INTEGER REFERENCES publicadores(id) ON DELETE CASCADE,
            notificacao_id TEXT NOT NULL, lida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (publicador_id, notificacao_id)
        );
        CREATE TABLE IF NOT EXISTS alertas_email_envios (
            chave TEXT PRIMARY KEY, publicador_id INTEGER REFERENCES publicadores(id) ON DELETE CASCADE,
            data_designacao DATE NOT NULL, antecedencia INTEGER NOT NULL,
            status TEXT NOT NULL, tentativas INTEGER NOT NULL DEFAULT 1,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), enviado_em TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS alertas_preferencias (
            publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
            email_designacoes BOOLEAN NOT NULL DEFAULT TRUE,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
}

export async function getAlertSettings(client) {
    await ensureAlertTables(client);
    const result = await client.query('SELECT dados FROM alertas_configuracao WHERE id = 1');
    return { ...DEFAULT_ALERT_SETTINGS, ...result.rows[0]?.dados };
}

export async function getActiveAssignments(client, { publisherId, today }) {
    const assignments = await getPublisherAssignments(client, { publisherId, since: today });
    // Keep cancellation and visit rules consistent with the meetings page.
    const { rows: events } = await client.query('SELECT data, tipo FROM eventos_especiais WHERE data >= $1::date - 7', [today]);
    const [calendarRes, configRes] = await Promise.all([
        client.query('SELECT id, data, tipo, cancelada, motivo_cancelamento FROM reunioes_registro WHERE data >= $1::date', [today]),
        client.query('SELECT ano, dia_fim_semana FROM configuracoes_gerais')
    ]);
    const calendar = calendarRes.rows.filter(m => m.id);
    const configs = new Map(configRes.rows.map(c => [String(c.ano), c]));
    return assignments.filter(a => {
        const date = dateKey(a.data_reuniao);
        const meeting = calendar.find(m => a.reuniao_id ? String(m.id) === String(a.reuniao_id) : dateKey(m.data) === date);
        if (meeting && meetingCancellation(meeting, events, configs.get(date.slice(0, 4))).cancelado) return false;
        if (a.origem === 'limpeza_semanal') return true;
        const midweek = a.origem === 'vida_ministerio' || (a.origem === 'privilegios_mecanicos' && a.descricao_semana === 'Meio de Semana');
        const visit = findVisitInWeek(events, date);
        if (midweek && visit && date !== getVisitTuesday(visit.data)) return false;
        return !events.some(e => {
            if (e.tipo === 'Visita do Superintendente') return false;
            const eventDate = dateKey(e.data);
            if (midweek && ['Celebração', 'Assembleia', 'Congresso'].includes(e.tipo) && getVisitTuesday(eventDate) === getVisitTuesday(date)) return true;
            return eventDate === date;
        });
    });
}

export async function getPersonalNotifications(client, publisherId, today) {
    const settings = await getAlertSettings(client);
    const assignments = await getActiveAssignments(client, { publisherId, today });
    let reportPending = false;
    if (settings.reportsEnabled) {
        const period = previousReportPeriod(today);
        const report = await client.query(`SELECT p.id FROM publicadores p
            LEFT JOIN grupos g ON g.id = p.grupo_id
            WHERE p.id = $1 AND (g.id IS NULL OR g.ativo = TRUE) AND NOT EXISTS (
                SELECT 1 FROM relatorios_mensais r WHERE r.publicador_id = p.id
                AND r.mes = $2 AND r.ano_servico = $3
                AND (r.participou_ministerio = TRUE OR r.horas IS NOT NULL OR r.estudos_biblicos IS NOT NULL)
            )`, [publisherId, period.month, period.serviceYear]);
        reportPending = report.rows.length > 0;
    }
    const notifications = buildNotifications({ assignments, settings, today, reportPending });
    const { rows: read } = await client.query('SELECT notificacao_id FROM alertas_lidos WHERE publicador_id = $1', [publisherId]);
    const readIds = new Set(read.map(row => row.notificacao_id));
    return notifications.map(n => ({ ...n, read: readIds.has(n.id) }));
}

export async function deliverReminders(client, reminders, sendMail) {
    const totals = { sent: 0, failed: 0, skipped: 0 };
    const processReminder = async reminder => {
        // A lease protects simultaneous invocations. Failed deliveries can be retried;
        // successful recipients are never reserved again for the same date/lead time.
        const claim = await client.query(`INSERT INTO alertas_email_envios
            (chave, publicador_id, data_designacao, antecedencia, status)
            VALUES ($1, $2, $3, $4, 'processando')
            ON CONFLICT (chave) DO UPDATE SET status = 'processando', tentativas = alertas_email_envios.tentativas + 1, atualizado_em = NOW()
            WHERE alertas_email_envios.status = 'falhou' OR
                (alertas_email_envios.status = 'processando' AND alertas_email_envios.atualizado_em < NOW() - INTERVAL '15 minutes')
            RETURNING chave`, [reminder.key, reminder.publisherId, reminder.date, reminder.days]);
        if (!claim.rows.length) { totals.skipped++; return; }
        try {
            const result = await sendMail(reminder);
            if (result?.rejected?.length) throw new Error('Destinatário recusado pelo servidor de e-mail.');
        } catch {
            await client.query("UPDATE alertas_email_envios SET status = 'falhou', atualizado_em = NOW() WHERE chave = $1", [reminder.key]);
            totals.failed++;
            return;
        }
        // Keep a DB failure after SMTP acceptance distinct from an SMTP rejection.
        await client.query("UPDATE alertas_email_envios SET status = 'enviado', enviado_em = NOW(), atualizado_em = NOW() WHERE chave = $1", [reminder.key]);
        await client.query(`UPDATE alertas_email_envios SET status = 'substituido', atualizado_em = NOW()
            WHERE publicador_id = $1 AND data_designacao = $2 AND chave <> $3 AND status = 'falhou'`, [reminder.publisherId, reminder.date, reminder.key]);
        totals.sent++;
    };
    // Bound SMTP concurrency so a large congregation does not exhaust connections.
    for (let i = 0; i < reminders.length; i += 5) {
        const results = await Promise.allSettled(reminders.slice(i, i + 5).map(processReminder));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
    }
    return totals;
}
