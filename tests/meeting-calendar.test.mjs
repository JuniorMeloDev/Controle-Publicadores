import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const calendar = await loadModule('../../app/lib/meeting-calendar.js');
const { generationRange, resolveProgramMeeting, meetingCancellation } = calendar;
const config = { ano: 2030, dia_meio_semana: 'Quarta-feira', dia_fim_semana: 'Domingo' };
const meetings = [
    { id: 910001, data: '2030-01-09', tipo: 'Meio de Semana' },
    { id: 910002, data: '2030-01-13', tipo: 'Fim de Semana' }
];
const permissionDependencies = {
    getUserIdFromRequest: () => 990001, getUserPermissions: async () => ({}), isAllowed: () => true,
    registerAuditLog: async () => {}
};
const request = body => ({ json: async () => body, url: 'http://example.test/api' });

test('next month uses an entire civil month; December advances into January', () => {
    assert.deepEqual(generationRange({ period: 'mensal', year: 2026, today: '2026-10-08' }), { start: '2026-11-01', end: '2026-11-30' });
    assert.deepEqual(generationRange({ period: 'mensal', year: 2026, today: '2026-12-31' }), { start: '2027-01-01', end: '2027-01-31' });
    assert.deepEqual(generationRange({ period: 'trimestral', year: 2026, today: '2026-10-31' }), { start: '2026-11-01', end: '2027-01-31' });
});

test('specific months include leap day and reject invalid selections', () => {
    assert.deepEqual(generationRange({ period: 'mes_especifico', month: 2, year: 2028, today: '2026-10-08' }), { start: '2028-02-01', end: '2028-02-29' });
    assert.throws(() => generationRange({ period: 'mes_especifico', month: 13, year: 2028, today: '2026-10-08' }));
    assert.equal(calendar.isCalendarDate('2030-02-30'), false);
});

test('program headings resolve to the real Wednesday, including a visit Tuesday', () => {
    assert.equal(resolveProgramMeeting('7 - 13 de janeiro', 2030, meetings).id, 910001);
    assert.equal(resolveProgramMeeting('7 - 13 de janeiro', 2030, [{ ...meetings[0], data: '2030-01-08' }]).data, '2030-01-08');
});

test('month and year boundary headings retain the first day month', () => {
    const meeting = { ...meetings[0], data: '2030-01-02' };
    assert.equal(resolveProgramMeeting('31 de dezembro - 6 de janeiro', 2029, [meeting]).id, 910001);
    assert.equal(resolveProgramMeeting('31 de dezembro - 6 de janeiro de 2029', 2028, [meeting]).id, 910001);
});

test('import refuses absent, cancelled or ambiguous meetings instead of inventing a date', () => {
    assert.throws(() => resolveProgramMeeting('7 - 13 de janeiro', 2030, []), /Não há reunião/);
    assert.throws(() => resolveProgramMeeting('7 - 13 de janeiro', 2030, [{ ...meetings[0], cancelado: true }]), /Não há reunião/);
    assert.throws(() => resolveProgramMeeting('7 - 13 de janeiro', 2030, [meetings[0], { ...meetings[0], id: 910003, data: '2030-01-10' }]), /mais de uma/);
});

test('manual cancellation and Sunday week events use the same state in every module', () => {
    assert.equal(meetingCancellation({ ...meetings[0], cancelada: true }, [], config).cancelado, true);
    assert.equal(meetingCancellation({ ...meetings[0], data: '2030-01-13' }, [{ data: '2030-01-08', tipo: 'Celebração', nome: 'Evento fictício' }], config).cancelado, true);
    assert.equal(meetingCancellation(meetings[0], [{ data: '2030-01-08', tipo: 'Visita do Superintendente', nome: 'Visita fictícia' }], config).cancelado, true);
});

function generatorFixture({ counts = [1, 0], failSecond = false, allow = true } = {}) {
    const calls = [];
    let inserts = 0;
    const client = { query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('FROM configuracoes_gerais')) return { rows: [config] };
        if (sql.includes('FROM eventos_especiais')) return { rows: [] };
        if (sql.includes('INSERT INTO reunioes_registro')) {
            if (failSecond && inserts === 1) throw new Error('Falha simulada');
            return { rowCount: counts[inserts++] || 0, rows: [] };
        }
        return { rows: [] };
    }, release() {} };
    return { calls, ...loadRoute('../../app/api/admin/reunioes/gerar/route.js', {
        Pool: class { connect() { return client; } }, ...permissionDependencies, ...calendar,
        findVisitInWeek: () => undefined, getVisitTuesday: () => '', isAllowed: () => allow
    }) };
}

test('batch generation counts actual inserts and preserves existing meetings', async () => {
    const route = generatorFixture();
    const response = await route.POST(request({ action: 'create', year: 2030, options: { meetings_to_create: meetings } }));
    assert.equal(response.body.created, 1);
    assert.equal(response.body.existing, 1);
    assert.equal(response.body.totals.meio_semana, 1);
    assert.ok(route.calls.some(c => c.sql === 'COMMIT'));
});

test('batch generation rolls back completely if a later insert fails', async () => {
    const route = generatorFixture({ failSecond: true });
    const response = await route.POST(request({ action: 'create', year: 2030, options: { meetings_to_create: meetings } }));
    assert.equal(response.status, 400);
    assert.ok(route.calls.some(c => c.sql === 'ROLLBACK'));
    assert.ok(!route.calls.some(c => c.sql === 'COMMIT'));
});

test('generation checks permission before creating even a custom meeting', async () => {
    const route = generatorFixture({ allow: false });
    assert.equal((await route.POST(request({ action: 'create_custom', data: meetings[0].data, tipo: meetings[0].tipo }))).status, 403);
    assert.equal(route.calls.length, 0);
});

test('moving a meeting synchronizes program, students and cleaning in a single transaction', async () => {
    const calls = [];
    const client = { query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: sql.includes('SELECT * FROM reunioes_registro') ? [meetings[0]] : [] };
    }, release() {} };
    const route = loadRoute('../../app/api/admin/reunioes/editar/route.js', {
        Pool: class { connect() { return client; } }, ...permissionDependencies, ...calendar
    });
    assert.equal((await route.POST(request({ id: 910001, nova_data: '2030-01-08' }))).status, 200);
    for (const table of ['reunioes_dados', 'designacoes_reuniao', 'limpeza_semanal', 'reunioes_registro']) {
        assert.ok(calls.some(c => c.sql.includes(`UPDATE ${table}`)));
    }
    assert.deepEqual([...calls.find(c => c.sql.includes('UPDATE reunioes_dados')).params], ['2030-01-08', 910001, '2030-01-09']);
    assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('cancellation preserves all designations and attendance instead of deleting rows', async () => {
    const calls = [];
    const client = { query: async sql => { calls.push(sql); return { rowCount: 1, rows: [] }; }, release() {} };
    const route = loadRoute('../../app/api/admin/reunioes/deletar/route.js', {
        Pool: class { connect() { return client; } }, ...permissionDependencies
    });
    assert.equal((await route.POST(request({ ids: [910001] }))).status, 200);
    assert.ok(calls.some(sql => sql.includes('SET cancelada = TRUE')));
    assert.equal(calls.some(sql => sql.includes('DELETE')), false);
});

test('calendar pending speeches save using the canonical date, even with a stale client date', async () => {
    const calls = [];
    const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: sql.includes('INSERT INTO discursos_publicos') ? [{ id: 960001 }] : [] }; }, release() {} };
    const route = loadRoute('../../app/api/admin/discursos/route.js', {
        Pool: class { connect() { return client; } }, ...permissionDependencies,
        lockAssignmentMeeting: async () => meetings[1]
    });
    const response = await route.POST(request({ reuniao_id: 910002, data: '2030-01-12', orador: 'Orador fictício' }));
    assert.equal(response.status, 201);
    const insert = calls.find(c => c.sql.includes('INSERT INTO discursos_publicos'));
    assert.equal(insert.params[0], '2030-01-13');
    assert.equal(insert.params[6], 910002);
});

test('cancelled calendar meetings refuse new speech assignments', async () => {
    const calls = [];
    const client = { query: async sql => { calls.push(sql); return { rows: [] }; }, release() {} };
    const route = loadRoute('../../app/api/admin/discursos/route.js', {
        Pool: class { connect() { return client; } }, ...permissionDependencies,
        lockAssignmentMeeting: async () => { throw new Error('Esta reunião está cancelada.'); }
    });
    assert.equal((await route.POST(request({ reuniao_id: 910002, data: '2030-01-13' }))).status, 400);
    assert.equal(calls.some(sql => sql.includes('INSERT INTO discursos_publicos')), false);
    assert.ok(calls.includes('ROLLBACK'));
});
