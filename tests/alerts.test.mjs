import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const alerts = await loadModule('../../app/lib/alerts.js');
const visits = await loadModule('../../app/lib/meeting-visits.js');
const { DEFAULT_ALERT_SETTINGS: defaults, buildNotifications, buildEmailReminders, previousReportPeriod, reminderMessage } = alerts;
const today = '2030-01-07';
const publishers = [
    { id: 990001, nome_completo: 'Pessoa Fictícia Alfa', nome_chamado: 'Fictícia Alfa', email: 'alfa@example.test' },
    { id: 990002, nome_completo: 'Pessoa Fictícia Beta', email: 'beta@example.test' },
];
const assignments = [
    { id: 'vida-990101', publicador_id: 990001, data_reuniao: '2030-01-09', nome_parte: 'Parte fictícia', categoria: 'Vida e Ministério', origem: 'vida_ministerio' },
    { id: 'mecanico-990102', publicador_id: 990001, data_reuniao: '2030-01-09', nome_parte: 'Volante', categoria: 'Privilégios Mecânicos', origem: 'privilegios_mecanicos', descricao_semana: 'Meio de Semana' },
    { id: 'limpeza-990103', publicador_id: 990001, data_reuniao: '2030-01-09', nome_parte: 'Limpeza semanal', categoria: 'Limpeza Semanal', origem: 'limpeza_semanal', descricao_semana: 'Grupo Fictício Alfa' },
    { id: 'presidente-990104', publicador_id: 990002, data_reuniao: '2030-01-13', nome_parte: 'Presidente do discurso público', categoria: 'Discursos Públicos', origem: 'discursos_publicos' },
];

test('notification windows include all sources, exclude past and redundant chairman parts', () => {
    const result = buildNotifications({ assignments: [...assignments,
        { ...assignments[0], id: 'old', data_reuniao: '2030-01-06' },
        { ...assignments[0], id: 'far', data_reuniao: '2030-02-01' },
        { ...assignments[0], id: 'comment', nome_parte: 'Comentários iniciais (1 min)' },
    ], settings: defaults, today });
    assert.equal(result.length, 4);
    assert.equal(result.filter(n => n.category === 'limpeza').length, 1);
    assert.equal(new Set(result.map(n => n.id)).size, 4);
    assert.equal(buildNotifications({ assignments, settings: { ...defaults, assignmentsEnabled: false, cleaningEnabled: false }, today }).length, 0);
});

test('previous report period handles civil year and service year boundaries', () => {
    assert.deepEqual(previousReportPeriod('2030-10-07'), { month: 'Setembro', serviceYear: 2031, calendarYear: 2030, key: '2030-09' });
    assert.deepEqual(previousReportPeriod('2030-09-07'), { month: 'Agosto', serviceYear: 2030, calendarYear: 2030, key: '2030-08' });
    assert.deepEqual(previousReportPeriod('2030-01-07'), { month: 'Dezembro', serviceYear: 2030, calendarYear: 2029, key: '2029-12' });
});

test('report becomes overdue after the configured day and disappears when submitted', () => {
    const before = buildNotifications({ assignments: [], settings: defaults, today: '2030-01-05', reportPending: true });
    const after = buildNotifications({ assignments: [], settings: defaults, today: '2030-01-06', reportPending: true });
    assert.equal(before[0].overdue, false); assert.equal(after[0].overdue, true);
    assert.notEqual(before[0].id, after[0].id);
    assert.equal(buildNotifications({ assignments: [], settings: defaults, today, reportPending: false }).length, 0);
});

test('settings reject malformed booleans, out-of-range values and strip unknown fields', () => {
    for (const input of [null, [], { emailEnabled: 'true' }, { assignmentDays: 0 }, { cleaningDays: 31 }, { reportDueDay: 29 }, { emailDays: 1.5 }]) {
        assert.throws(() => alerts.validateAlertSettings(input));
    }
    assert.deepEqual(alerts.validateAlertSettings({ ...defaults, unknown: true }), { ...defaults });
});

test('Brazil time and date arithmetic remain correct across UTC midnight and months', () => {
    assert.equal(alerts.todayInBrazil(new Date('2030-01-08T01:00:00Z')), '2030-01-07');
    assert.equal(alerts.daysBetween('2030-01-31', '2030-02-02'), 2);
    assert.equal(alerts.dateKey(new Date('2030-01-09T03:00:00Z')), '2030-01-09');
});

test('email defaults off, consolidates each recipient/date, and cleaning is opt-in', () => {
    assert.equal(buildEmailReminders({ assignments, publishers, settings: defaults, today }).length, 0);
    const settings = { ...defaults, emailEnabled: true };
    const result = buildEmailReminders({ assignments, publishers, settings, today });
    assert.equal(result.length, 1); assert.equal(result[0].assignments.length, 2);
    assert.equal(result[0].email, 'alfa@example.test');
    assert.equal(buildEmailReminders({ assignments, publishers, settings: { ...settings, emailCleaning: true }, today })[0].assignments.length, 3);
    assert.equal(buildEmailReminders({ assignments, publishers, settings: { ...settings, emailOnDay: false }, today: '2030-01-09' }).length, 0);
    assert.equal(buildEmailReminders({ assignments, publishers, settings, today: '2030-01-09' })[0].days, 0);
});

test('failed delivery is rebuilt from current assignments the next day, never after its date', () => {
    const settings = { ...defaults, emailEnabled: true };
    const retries = [{ publicador_id: 990001, data_designacao: '2030-01-09', antecedencia: 2 }];
    const result = buildEmailReminders({ assignments, publishers, settings, today: '2030-01-08', retries });
    assert.equal(result.length, 1); assert.equal(result[0].key, '990001:2030-01-09:2');
    assert.equal(buildEmailReminders({ assignments: [], publishers, settings, today: '2030-01-08', retries }).length, 0);
    assert.equal(buildEmailReminders({ assignments, publishers, settings, today: '2030-01-10', retries }).length, 0);
    const onDay = buildEmailReminders({ assignments, publishers, settings, today: '2030-01-09', retries });
    assert.equal(onDay.length, 1); assert.equal(onDay[0].key, '990001:2030-01-09:0');
});

test('email skips unknown recipients and escapes all HTML from names and assignment titles', () => {
    assert.equal(buildEmailReminders({ assignments, publishers: [{ ...publishers[0], email: 'invalid' }], settings: { ...defaults, emailEnabled: true }, today }).length, 0);
    const message = reminderMessage({ name: '<script>fake</script>', date: '2030-01-09', assignments: [{ nome_parte: 'A & B <img>', categoria: 'Categoria fictícia' }] });
    assert.ok(!message.html.includes('<script>')); assert.ok(!message.html.includes('<img>'));
    assert.match(message.html, /&lt;script&gt;/); assert.match(message.text, /09\/01\/2030/);
});

function serviceFixture(dependencies = {}) {
    const source = readFileSync(new URL('../app/lib/alert-service.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    const context = vm.createContext({ ...alerts, ...visits, ...dependencies });
    vm.runInContext(source + '\nglobalThis.result = { getPersonalNotifications, getActiveAssignments, deliverReminders };', context);
    return context.result;
}

test('personal notifications bind identity to queries and preserve persisted read state', async () => {
    const queries = [];
    const service = serviceFixture({ getPublisherAssignments: async (_client, options) => {
        assert.equal(options.publisherId, 990001); return assignments.filter(a => a.publicador_id === 990001);
    } });
    const notificationId = buildNotifications({ assignments, settings: defaults, today })[0].id;
    const client = { query: async (sql, values) => {
        queries.push({ sql, values });
        if (sql.includes('SELECT notificacao_id')) return { rows: [{ notificacao_id: notificationId }] };
        if (sql.includes('SELECT p.id')) { assert.deepEqual([...values], [990001, 'Dezembro', 2030]); return { rows: [] }; }
        return { rows: [] };
    } };
    const result = await service.getPersonalNotifications(client, 990001, today);
    assert.equal(result.length, 3); assert.equal(result.find(n => n.id === notificationId).read, true);
    assert.ok(result.every(n => !n.id.includes('990104')));
    const reportQuery = queries.find(q => q.sql.includes('relatorios_mensais')).sql;
    assert.match(reportQuery, /participou_ministerio = TRUE OR r.horas IS NOT NULL OR r.estudos_biblicos IS NOT NULL/);
});

test('cancelled meetings and moved visit Wednesdays do not trigger reminders', async () => {
    const service = serviceFixture({ getPublisherAssignments: async () => assignments });
    const client = { query: async () => ({ rows: [{ data: '2030-01-08', tipo: 'Visita do Superintendente' }] }) };
    const rows = await service.getActiveAssignments(client, { today });
    assert.equal(rows.length, 2); assert.ok(rows.some(a => a.origem === 'limpeza_semanal'));
    const cancelled = await service.getActiveAssignments({ query: async () => ({ rows: [{ data: '2030-01-13', tipo: 'Assembleia' }] }) }, { today });
    assert.equal(cancelled.length, 1); assert.equal(cancelled[0].origem, 'limpeza_semanal');
});

test('delivery retries only failures and never repeats a confirmed recipient', async () => {
    const ledger = new Map(); let failBeta = true; const sent = [];
    const client = { query: async (sql, values) => {
        const key = values[0];
        if (sql.includes('INSERT INTO alertas_email_envios')) {
            if (ledger.get(key) === 'enviado' || ledger.get(key) === 'processando') return { rows: [] };
            ledger.set(key, 'processando'); return { rows: [{ chave: key }] };
        }
        if (sql.includes("status = 'falhou',")) ledger.set(key, 'falhou');
        if (sql.includes("status = 'enviado',")) ledger.set(key, 'enviado');
        return { rows: [] };
    } };
    const service = serviceFixture();
    const reminders = publishers.map(p => ({ key: `ficticio-${p.id}`, publisherId: p.id, date: '2030-01-09', days: 2 }));
    const send = async r => { sent.push(r.key); if (r.publisherId === 990002 && failBeta) throw new Error('Simulated SMTP failure'); return { accepted: ['fake@example.test'], rejected: [] }; };
    const first = await service.deliverReminders(client, reminders, send);
    assert.deepEqual({ ...first }, { sent: 1, failed: 1, skipped: 0 });
    failBeta = false;
    const second = await service.deliverReminders(client, reminders, send);
    assert.deepEqual({ ...second }, { sent: 1, failed: 0, skipped: 1 });
    assert.equal(sent.filter(key => key === 'ficticio-990001').length, 1);
});

test('SMTP acceptance followed by DB failure does not record a delivery rejection', async () => {
    const queries = [];
    const service = serviceFixture();
    const client = { query: async sql => {
        queries.push(sql);
        if (sql.includes('INSERT')) return { rows: [{ chave: 'ficticio-990001' }] };
        if (sql.includes("status = 'enviado',")) throw new Error('Simulated DB outage');
        return { rows: [] };
    } };
    await assert.rejects(service.deliverReminders(client, [{ key: 'ficticio-990001', publisherId: 990001, date: '2030-01-09', days: 2 }], async () => ({ rejected: [] })));
    assert.ok(!queries.some(q => q.includes("status = 'falhou',")));
});

function notificationRoute(userId = 990001) {
    const queries = [];
    const route = loadRoute('../../app/api/admin/notificacoes/route.js', {
        Pool: class { connect() { return { query: async (sql, values) => { queries.push({ sql, values }); return { rows: [] }; }, release() {} }; } },
        getUserIdFromRequest: () => userId,
        todayInBrazil: () => today,
        getPersonalNotifications: async (_client, id) => { assert.equal(id, userId); return [{ id: 'own-ficticio', read: false }]; },
    });
    return { ...route, queries };
}

test('notification endpoint denies unauthenticated requests and ignores foreign read IDs', async () => {
    assert.equal((await notificationRoute(null).GET({})).status, 401);
    const route = notificationRoute();
    const result = await route.POST({ json: async () => ({ ids: ['own-ficticio', 'foreign-ficticio'], publisherId: 990002 }) });
    assert.equal(result.body.unread, 0);
    assert.equal(route.queries[0].values[0], 990001);
    assert.deepEqual([...route.queries[0].values[1]], ['own-ficticio']);
    assert.equal((await route.POST({ json: async () => ({ ids: [12] }) })).status, 400);
});

test('cron fails closed without a secret and ignores a spoofed scheduler flag', async () => {
    let connects = 0;
    const fixture = env => loadRoute('../../app/api/cron/lembretes/route.js', {
        Pool: class { connect() { connects++; throw new Error('Must not connect'); } }, process: { env },
    });
    assert.equal((await fixture({}).GET({ headers: new Headers({ 'x-vercel-cron': '1' }) })).status, 401);
    assert.equal((await fixture({ CRON_SECRET: 'fictitious-test-secret' }).GET({ headers: new Headers({ authorization: 'Bearer wrong', 'x-vercel-cron': '1' }) })).status, 401);
    assert.equal(connects, 0);
});

test('authorized cron honors disabled email settings without constructing an SMTP transport', async () => {
    const route = loadRoute('../../app/api/cron/lembretes/route.js', {
        Pool: class { connect() { return { release() {} }; } },
        process: { env: { CRON_SECRET: 'fictitious-test-secret' } },
        getAlertSettings: async () => defaults,
        nodemailer: { createTransport() { throw new Error('Must not send'); } },
    });
    assert.equal((await route.GET({ headers: new Headers({ authorization: 'Bearer fictitious-test-secret' }) })).status, 200);
});

test('settings require explicit permission and SMTP/cron setup before enabling emails', async () => {
    let writes = 0;
    const fixture = permitted => loadRoute('../../app/api/admin/alertas/configuracoes/route.js', {
        Pool: class { connect() { return { query: async () => { writes++; return { rows: [] }; }, release() {} }; } },
        getUserIdFromRequest: () => 990001, getUserPermissions: async () => ({}), isAllowed: () => permitted,
        getAlertSettings: async () => defaults, validateAlertSettings: alerts.validateAlertSettings,
    });
    assert.equal((await fixture(false).POST({ json: async () => defaults })).status, 403);
    assert.equal((await fixture(true).POST({ json: async () => ({ ...defaults, emailEnabled: true }) })).status, 400);
    assert.equal(writes, 0);
});

test('settings save is audited atomically and email activation needs its own permission', async () => {
    const calls = [];
    let auditFails = false;
    const env = { EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'fictitious-password', CRON_SECRET: 'fictitious-test-secret' };
    const fixture = emailPermission => loadRoute('../../app/api/admin/alertas/configuracoes/route.js', {
        Pool: class { connect() { return { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; }, release() {} }; } },
        process: { env }, getUserIdFromRequest: () => 990001, getUserPermissions: async () => ({}),
        isAllowed: (_permissions, key) => key !== 'designacoes_email' || emailPermission,
        getAlertSettings: async () => defaults, validateAlertSettings: alerts.validateAlertSettings,
        registerAuditLog: async (_client, details) => { assert.equal(details.userId, 990001); if (auditFails) throw new Error('Simulated audit outage'); },
    });
    assert.equal((await fixture(false).POST({ json: async () => ({ ...defaults, emailEnabled: true }) })).status, 403);
    assert.equal(calls.length, 0);
    const result = await fixture(true).POST({ json: async () => ({ ...defaults, emailEnabled: true, emailDays: 3 }) });
    assert.equal(result.status, 200); assert.equal(result.body.settings.emailDays, 3);
    assert.equal(calls[0].sql, 'BEGIN'); assert.ok(calls.some(c => c.sql === 'COMMIT'));
    calls.length = 0; auditFails = true;
    assert.equal((await fixture(true).POST({ json: async () => defaults })).status, 500);
    assert.ok(calls.some(c => c.sql === 'ROLLBACK')); assert.ok(!calls.some(c => c.sql === 'COMMIT'));
});

test('cron builds personalized messages using a simulated mail transport only', async () => {
    const outgoing = [];
    const client = { query: async sql => ({ rows: sql.includes('SELECT p.id') ? publishers : [] }), release() {} };
    const route = loadRoute('../../app/api/cron/lembretes/route.js', {
        Pool: class { connect() { return client; } },
        process: { env: { CRON_SECRET: 'fictitious-test-secret', EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'fictitious-password' } },
        getAlertSettings: async () => ({ ...defaults, emailEnabled: true }),
        todayInBrazil: () => today, getActiveAssignments: async () => assignments,
        buildEmailReminders, reminderMessage,
        nodemailer: { createTransport: () => ({ sendMail: async mail => { outgoing.push(mail); return { accepted: [mail.to], rejected: [] }; } }) },
        deliverReminders: async (_client, reminders, send) => { for (const reminder of reminders) await send(reminder); return { sent: reminders.length, skipped: 0, failed: 0 }; },
    });
    const result = await route.GET({ headers: new Headers({ authorization: 'Bearer fictitious-test-secret' }) });
    assert.equal(result.status, 200); assert.equal(result.body.sent, 1);
    assert.equal(outgoing[0].to, 'alfa@example.test');
    assert.match(outgoing[0].html, /Volante/); assert.match(outgoing[0].html, /Parte fictícia/);
    assert.ok(!outgoing[0].html.includes('Pessoa Fictícia Beta'));
});
