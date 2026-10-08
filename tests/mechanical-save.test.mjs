import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { getWeekStart } = await loadModule('../../app/lib/mechanical-assignments.js');
const calendar = await loadModule('../../app/lib/meeting-calendar.js');
const fixtureMeetings = [{ id: 910001, data: '2030-01-09', tipo: 'Meio de Semana' }, { id: 910002, data: '2030-01-13', tipo: 'Fim de Semana' }];
const body = { reunioes: fixtureMeetings.map(m => ({ reuniao_id: m.id, assignments: [{ tipo_id: 920001, publicador_id: 900001 }] })) };

function routeFixture({ failSecond = false, permitted = true, events = [] } = {}) {
    const calls = [];
    const client = {
        async query(sql, params) {
            calls.push({ sql, params });
            if (sql.startsWith('SELECT id, data')) return { rows: fixtureMeetings };
            if (sql.startsWith('SELECT id, nome')) return { rows: [{ id: 920001, nome: 'Volante' }] };
            if (sql.startsWith('SELECT id FROM publicadores')) return { rows: [{ id: 900001 }] };
            if (failSecond && sql.startsWith('INSERT INTO reunioes_privilegios') && params[0] === 910002) throw new Error('Synthetic save failure');
            return { rows: [] };
        }, release() { calls.push({ sql: 'RELEASE' }); }
    };
    const handlers = loadRoute('../../app/api/admin/privilegios/atribuicoes/route.js', {
        Pool: class { connect() { return client; } },
        getUserIdFromRequest: () => 990001, getUserPermissions: async () => ({}),
        isAllowed: () => permitted, registerAuditLog: async () => {}, getWeekStart, ...calendar,
        getCalendarContext: async () => ({ configs: new Map(), events })
    });
    return { ...handlers, calls };
}

test('week saves both meetings atomically and preserves non-submitted privilege types', async () => {
    const route = routeFixture();
    const result = await route.POST({ json: async () => body });
    assert.equal(result.status, 200);
    assert.equal(route.calls.filter(c => c.sql.startsWith('INSERT INTO reunioes_privilegios')).length, 2);
    assert.ok(route.calls.filter(c => c.sql.startsWith('DELETE')).every(c => c.sql.includes('privilegio_tipo_id = ANY')));
    assert.equal(route.calls.filter(c => c.sql.startsWith('UPDATE reunioes_registro SET volante_id')).length, 2);
    assert.ok(route.calls.some(c => c.sql === 'COMMIT'));
});

test('a visit added after opening the form blocks a stale Wednesday save', async () => {
    const route = routeFixture({ events: [{ data: '2030-01-08', tipo: 'Visita do Superintendente' }] });
    const result = await route.POST({ json: async () => body });
    assert.equal(result.status, 400);
    assert.equal(route.calls.some(c => c.sql.startsWith('DELETE') || c.sql.startsWith('INSERT')), false);
    assert.ok(route.calls.some(c => c.sql === 'ROLLBACK'));
});

test('a failure on the second meeting rolls back the whole week', async () => {
    const route = routeFixture({ failSecond: true });
    const result = await route.POST({ json: async () => body });
    assert.equal(result.status, 500);
    assert.ok(route.calls.some(c => c.sql === 'ROLLBACK'));
    assert.equal(route.calls.some(c => c.sql === 'COMMIT'), false);
});

test('permissions are checked before any assignment write', async () => {
    const route = routeFixture({ permitted: false });
    const result = await route.POST({ json: async () => body });
    assert.equal(result.status, 403);
    assert.deepEqual(route.calls.map(c => c.sql), ['RELEASE']);
});

test('duplicate privilege types are rejected before reaching the database', async () => {
    const route = routeFixture();
    const result = await route.POST({ json: async () => ({ reunioes: [{
        reuniao_id: 910001, assignments: [body.reunioes[0].assignments[0], body.reunioes[0].assignments[0]]
    }] }) });
    assert.equal(result.status, 400);
    assert.equal(route.calls.length, 0);
});

test('clearing a privilege removes the assignment and clears the legacy column', async () => {
    const route = routeFixture();
    const result = await route.POST({ json: async () => ({ reunioes: fixtureMeetings.map(m => ({
        reuniao_id: m.id, assignments: [{ tipo_id: 920001, publicador_id: null }]
    })) }) });
    assert.equal(result.status, 200);
    assert.equal(route.calls.filter(c => c.sql.startsWith('INSERT INTO reunioes_privilegios')).length, 0);
    assert.ok(route.calls.filter(c => c.sql.startsWith('UPDATE')).every(c => c.params[0] === null));
});
