import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the route handlers with database fixtures, without writing to a real database.
const helperSource = readFileSync(new URL('../app/lib/meeting-visits.js', import.meta.url), 'utf8')
    .replace(/export /g, '');
const visit = { data: '2030-01-15T03:00:00Z', ano: 2030, tipo: 'Visita do Superintendente', nome: 'Visita' };
const config = { dia_meio_semana: 'Quarta-feira', dia_fim_semana: 'Domingo' };

function loadRoute(file, { events = [visit], weekdays = config, meetings = [] } = {}) {
    const writes = [];
    const client = {
        async query(sql, params) {
            if (sql.includes('FROM eventos_especiais')) return { rows: events };
            if (sql.includes('FROM configuracoes_gerais')) return { rows: [weekdays] };
            if (sql.includes('FROM reunioes_registro r')) return { rows: meetings };
            if (sql.includes('SELECT COUNT(*)')) return { rows: [{ count: '1' }] };
            if (sql.includes('INSERT INTO reunioes_registro')) writes.push(params);
            return { rows: [] };
        },
        release() {}
    };
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '')
        .replace(/export /g, '');
    const context = vm.createContext({
        Pool: class { connect() { return client; } },
        NextResponse: { json: data => data },
        URL, Intl, console, process: { env: {} },
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : ['2030-01-02T12:00:00Z'])); }
        }
    });
    vm.runInContext(helperSource + '\n' + source + '\nglobalThis.handlers = { POST, ' +
        (file.includes('/gerar/') ? '' : 'GET, ') + '};', context);
    return { ...context.handlers, writes };
}

function request(body) {
    return { json: async () => body, url: 'http://localhost/api/admin/reunioes?year=2030&month=1' };
}

test('Tuesday visit is active, Wednesday is canceled, Sunday remains active', async () => {
    const route = loadRoute('../app/api/admin/reunioes/route.js', {
        meetings: [
            { id: 910101, data: '2030-01-15T03:00:00Z', tipo: 'Meio de Semana' },
            { id: 910102, data: '2030-01-16T03:00:00Z', tipo: 'Meio de Semana' },
            { id: 910103, data: '2030-01-20T03:00:00Z', tipo: 'Fim de Semana' }
        ]
    });
    const rows = await route.GET(request());
    assert.equal(rows.find(r => r.id === 910101).cancelado, false);
    assert.equal(rows.find(r => r.id === 910102).cancelado, true);
    assert.equal(rows.find(r => r.id === 910103).cancelado, false);
});

test('a visit does not produce a canceled virtual event', async () => {
    const rows = await loadRoute('../app/api/admin/reunioes/route.js').GET(request());
    assert.equal(rows.length, 0);
});

test('another event on Tuesday still cancels the meeting', async () => {
    const route = loadRoute('../app/api/admin/reunioes/route.js', {
        events: [visit, { ...visit, tipo: 'Celebração' }],
        meetings: [{ id: 910101, data: visit.data, tipo: 'Meio de Semana' }]
    });
    const rows = await route.GET(request());
    assert.equal(rows[0].cancelado, true);
    assert.match(rows[0].motivo_cancelamento, /Celebração/);
});

test('generation substitutes Tuesday for Wednesday only during the visit week', async () => {
    const route = loadRoute('../app/api/admin/reunioes/gerar/route.js');
    const result = await route.POST(request({ action: 'preview', period: 'mensal', year: 2030 }));
    assert.equal(result.meetings.filter(m => m.data === '2030-01-15').length, 1);
    assert.equal(result.meetings.some(m => m.data === '2030-01-16'), false);
    assert.equal(result.meetings.some(m => m.data === '2030-01-09'), true);
    assert.equal(result.meetings.some(m => m.data === '2030-01-23'), true);
});

test('visit on Sunday affects the preceding Tuesday, including across a month boundary', async () => {
    const route = loadRoute('../app/api/admin/reunioes/gerar/route.js', {
        events: [{ ...visit, data: '2030-02-03T03:00:00Z' }]
    });
    const result = await route.POST(request({ action: 'preview', period: 'mensal', year: 2030 }));
    assert.equal(result.meetings.some(m => m.data === '2030-01-29'), true);
    assert.equal(result.meetings.some(m => m.data === '2030-01-30'), false);
});

test('visit does not duplicate the meeting when the regular day is Tuesday', async () => {
    const route = loadRoute('../app/api/admin/reunioes/gerar/route.js', {
        weekdays: { ...config, dia_meio_semana: 'Terça-feira' }
    });
    const result = await route.POST(request({ action: 'preview', period: 'mensal', year: 2030 }));
    assert.equal(result.meetings.filter(m => m.data === '2030-01-15').length, 1);
});

test('a conflicting celebration prevents generation of the visit meeting', async () => {
    const route = loadRoute('../app/api/admin/reunioes/gerar/route.js', {
        events: [visit, { ...visit, tipo: 'Celebração' }]
    });
    const result = await route.POST(request({ action: 'preview', period: 'mensal', year: 2030 }));
    assert.equal(result.meetings.some(m => m.data === '2030-01-15'), false);
});

test('creation normalizes a stale Wednesday selection to Tuesday', async () => {
    const route = loadRoute('../app/api/admin/reunioes/gerar/route.js');
    await route.POST(request({
        action: 'create', year: 2030,
        options: { meetings_to_create: [{ data: '2030-01-16', tipo: 'Meio de Semana' }] }
    }));
    assert.equal(route.writes[0][0], '2030-01-15');
});
