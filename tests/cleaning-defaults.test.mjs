import test from 'node:test';
import assert from 'node:assert/strict';
import { cleaningDefaultTasks } from '../app/lib/cleaning-defaults.js';
import { loadRoute } from './helpers/load-source.mjs';

const defaults = { meio_semana: 'Varrer e recolher o lixo', fim_semana: 'Limpeza completa' };
test('cleaning defaults use the meeting type, including transferred meetings', () => {
    assert.equal(cleaningDefaultTasks('', [], defaults), '');
    assert.equal(cleaningDefaultTasks('2026-10-27', [{ data: '2026-10-27', tipo: 'Meio de Semana' }], defaults), defaults.meio_semana);
    assert.equal(cleaningDefaultTasks('2026-10-31', [{ data: '2026-10-31', tipo: 'Meio de Semana' }], defaults), defaults.meio_semana);
    assert.equal(cleaningDefaultTasks('2026-10-30', [{ data: '2026-10-30', tipo: 'Fim de Semana' }], defaults), defaults.fim_semana);
    assert.equal(cleaningDefaultTasks('2026-11-01', [], defaults), defaults.fim_semana);
    assert.equal(cleaningDefaultTasks('2026-11-04', [], defaults), defaults.meio_semana);
});

function fixture(allowed = true) {
    const calls = [];
    const route = loadRoute('../../app/api/admin/limpeza/tarefas-padrao/route.js', {
        Pool: class { async connect() { return { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [defaults] }; }, release() {} }; } },
        getUserIdFromRequest: () => 1, getUserPermissions: async () => ({}), isAllowed: () => allowed, registerAuditLog: async () => {}
    });
    return { route, calls };
}
test('saved templates return both texts and never modify existing assignments', async () => {
    const { route, calls } = fixture();
    assert.equal((await route.PUT({ json: async () => defaults })).status, 200);
    assert.deepEqual(Array.from(calls.find(call => call.sql.startsWith('INSERT')).params), [defaults.meio_semana, defaults.fim_semana]);
    assert.equal(calls.at(-1).sql, 'COMMIT');
    assert.deepEqual((await route.GET({})).body, defaults);
    assert.equal(calls.some(call => /UPDATE limpeza_semanal/.test(call.sql)), false);
});
test('template writes reject missing permissions and malformed values', async () => {
    assert.equal((await fixture(false).route.PUT({ json: async () => defaults })).status, 403);
    assert.equal((await fixture().route.PUT({ json: async () => ({ meio_semana: 123, fim_semana: '' }) })).status, 400);
});
