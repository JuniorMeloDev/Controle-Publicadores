import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const alerts = await loadModule('../../app/lib/alerts.js');
const calendar = await loadModule('../../app/lib/meeting-calendar.js');
const template = await loadModule('../../app/lib/meeting-absence.js');
const source = readFileSync(new URL('../app/lib/meeting-absence-service.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const context = vm.createContext({ ...calendar, ...template });
vm.runInContext(source + '\nglobalThis.service = { deliverAbsenceEmails };', context);
const { deliverAbsenceEmails } = context.service;
const settings = { ...alerts.DEFAULT_ALERT_SETTINGS, absenceEmailEnabled: true, absenceRecipientIds: [1, 2] };
const meeting = { id: 30, data: '2026-11-11', tipo: 'Meio de Semana' };

test('absence rule defaults off and validates explicit recipients', () => {
    assert.equal(alerts.DEFAULT_ALERT_SETTINGS.absenceEmailEnabled, false);
    for (const value of [{ absenceEmailEnabled: true }, { absenceRecipientIds: ['1'] }, { absenceRecipientIds: [0] }, { absenceEmailEnabled: 'true' }]) {
        assert.throws(() => alerts.validateAlertSettings(value));
    }
    assert.deepEqual(alerts.validateAlertSettings({ ...settings, absenceRecipientIds: [1, 1, 2] }).absenceRecipientIds, [1, 2]);
});

function fixture({ meetings = [meeting], events = [] } = {}) {
    const calls = [], ledger = new Map(), messages = [];
    let fail = true;
    const client = { query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('SELECT r.*')) return { rows: meetings };
        if (sql.includes('FROM eventos_especiais')) return { rows: events };
        if (sql.includes('SELECT ano')) return { rows: [] };
        if (sql.includes('SELECT p.id')) return { rows: [1, 2, 3].map(id => ({ id, email: `person${id}@example.test` })) };
        if (sql.includes('SELECT p.nome_completo')) return { rows: [{ nome_completo: '<Pessoa ausente>', nome_grupo: 'Grupo & A' }] };
        if (sql.includes('INSERT INTO assistencia_email_envios')) {
            const id = values[1];
            if (ledger.get(id) === 'enviado' || (!values[2] && !ledger.has(id))) return { rows: [] };
            ledger.set(id, 'processando'); return { rows: [{ reuniao_id: values[0] }] };
        }
        if (sql.includes("SET status = 'falhou'")) ledger.set(values[1], 'falhou');
        if (sql.includes("SET status = 'enviado'")) ledger.set(values[1], 'enviado');
        return { rows: [] };
    } };
    return { calls, ledger, messages, retry() { fail = false; }, run: (overrides = {}) => deliverAbsenceEmails(client, {
        settings, today: '2026-11-12', sendMail: async mail => {
            messages.push(mail);
            if (mail.to === 'person2@example.test' && fail) throw new Error('Simulated SMTP failure');
            return { rejected: [] };
        }, ...overrides,
    }) };
}

test('next-day delivery selects saved attendance, excludes both presence modes, and retries only failures', async () => {
    const f = fixture();
    assert.deepEqual({ ...await f.run() }, { sent: 1, failed: 1, skipped: 0 });
    const query = f.calls.find(c => c.sql.includes('SELECT r.*'));
    assert.equal(query.values[0], '2026-11-11');
    assert.match(query.sql, /EXISTS \(SELECT 1 FROM assistencia_registros_salvos/);
    assert.match(f.calls.find(c => c.sql.includes('SELECT p.nome_completo')).sql, /IN \('Presencial', 'Zoom'\)/);
    assert.match(f.messages[0].subject, /11\/11\/2026/);
    assert.match(f.messages[0].html, /&lt;Pessoa ausente&gt;/);
    assert.ok(!f.messages.some(mail => mail.to === 'person3@example.test'));
    f.retry();
    assert.deepEqual({ ...await f.run({ today: '2026-11-13' }) }, { sent: 1, failed: 0, skipped: 1 });
    assert.equal(f.messages.filter(mail => mail.to === 'person1@example.test').length, 1);
});

test('disabled rule, unsaved meetings and cancellations never send reports', async () => {
    const disabled = fixture();
    await disabled.run({ settings: alerts.DEFAULT_ALERT_SETTINGS });
    assert.equal(disabled.calls.length, 0);
    for (const options of [{ meetings: [] }, { meetings: [{ ...meeting, cancelada: true }] }, { events: [{ data: meeting.data, tipo: 'Assembleia', nome: 'Evento' }] }]) {
        const f = fixture(options); await f.run(); assert.equal(f.messages.length, 0);
    }
});

test('empty absence list explicitly reports everyone present', () => {
    assert.match(template.absenceMessage(meeting, []).text, /Todos os publicadores tiveram presença registrada/);
});

test('absence cron works independently with assignment reminders disabled', async () => {
    let processed = false;
    const route = loadRoute('../../app/api/cron/lembretes/route.js', {
        Pool: class { connect() { return { release() {} }; } },
        process: { env: { CRON_SECRET: 'test', EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'test' } },
        getAlertSettings: async () => ({ ...settings, emailEnabled: false }),
        nodemailer: { createTransport: () => ({}) },
        deliverAbsenceEmails: async (_client, options) => { processed = true; assert.equal(options.settings.emailEnabled, false); return { sent: 2, failed: 0, skipped: 0 }; },
    });
    const response = await route.GET({ headers: new Headers({ authorization: 'Bearer test' }) });
    assert.equal(response.status, 200); assert.equal(response.body.absence.sent, 2); assert.equal(processed, true);
});

test('configuration rejects recipients without an eligible registered email', async () => {
    const route = loadRoute('../../app/api/admin/alertas/configuracoes/route.js', {
        Pool: class { connect() { return { query() { throw new Error('Must not save'); }, release() {} }; } },
        process: { env: { CRON_SECRET: 'test', EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'test' } },
        getUserIdFromRequest: () => 1, getUserPermissions: async () => ({}), isAllowed: () => true,
        getAlertSettings: async () => alerts.DEFAULT_ALERT_SETTINGS, validateAlertSettings: alerts.validateAlertSettings,
        getAbsenceRecipients: async () => [{ id: 1 }],
    });
    assert.equal((await route.POST({ json: async () => settings })).status, 400);
});

test('saving attendance confirms completion atomically, including an explicitly empty list', async () => {
    const calls = [];
    let fail = false;
    const route = loadRoute('../../app/api/admin/reunioes/[id]/assistencia/route.js', {
        Pool: class { connect() { return { query: async sql => {
            calls.push(sql);
            if (fail && sql.includes('INSERT INTO assistencia_registros_salvos')) throw new Error('Simulated DB failure');
            return { rows: [] };
        }, release() {} }; } },
        ensureAbsenceTables: async () => {},
    });
    const request = { json: async () => ({ assistanceData: [] }) };
    assert.equal((await route.POST(request, { params: Promise.resolve({ id: '30' }) })).status, 200);
    assert.ok(calls.findIndex(q => q.includes('INSERT INTO assistencia_registros_salvos')) < calls.indexOf('COMMIT'));
    calls.length = 0; fail = true;
    assert.equal((await route.POST(request, { params: Promise.resolve({ id: '30' }) })).status, 500);
    assert.ok(calls.includes('ROLLBACK')); assert.ok(!calls.includes('COMMIT'));
    calls.length = 0;
    assert.equal((await route.POST({ json: async () => ({ assistanceData: [{ publicador_id: 1, modalidade: 'Invalid' }] }) }, { params: Promise.resolve({ id: '30' }) })).status, 400);
    assert.equal(calls.length, 0);
});
