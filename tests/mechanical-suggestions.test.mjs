import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const helpers = await loadModule('../../app/lib/mechanical-assignments.js');
const calendar = await loadModule('../../app/lib/meeting-calendar.js');
const fixtureMeetings = [
    { id: 910001, data: new Date('2030-01-09T03:00:00Z'), tipo: 'Meio de Semana' },
    { id: 910002, data: new Date('2030-01-13T03:00:00Z'), tipo: 'Fim de Semana' }
];
const fixtureTypes = [{ id: 920001, nome: 'Volante', ativo: true, ordem: 0 }];
const fixturePublishers = [
    { id: 900001, nome_completo: 'Publicador Fictício Alfa', sexo: 'Masculino', data_batismo: '2000-01-01', privilegios: [] },
    { id: 900002, nome_completo: 'Publicador Fictício Beta', sexo: 'Masculino', data_batismo: '2000-01-01', privilegios: [] }
];

function routeFixture(permitted = true, events = []) {
    const calls = [];
    const handlers = loadRoute('../../app/api/admin/privilegios/sugestoes/route.js', {
        Pool: class { connect() { return {
            query: async sql => {
                calls.push(sql);
                if (sql.includes('FROM reunioes_registro')) return { rows: fixtureMeetings };
                if (sql.includes('FROM privilegios_tipos')) return { rows: fixtureTypes };
                return { rows: fixturePublishers };
            }, release() {}
        }; } },
        getUserIdFromRequest: () => 990001,
        getUserPermissions: async () => ({}), isAllowed: () => permitted,
        getPublisherAssignments: async () => [], ...helpers, ...calendar,
        getCalendarContext: async () => ({ configs: new Map(), events })
    });
    return { ...handlers, calls };
}

test('suggestion endpoint handles SQL Date objects chronologically and performs no writes', async () => {
    const route = routeFixture();
    const result = await route.POST({ json: async () => ({ semana: '2030-01-07', reuniao_ids: [910001, 910002] }) });
    assert.equal(result.status, 200);
    assert.equal(result.body.assignments[0].reuniao_id, 910001);
    assert.equal(new Set(result.body.assignments.map(a => a.publicador_id)).size, 2);
    assert.ok(route.calls.every(sql => sql.trim().startsWith('SELECT')));
});

test('suggestions refuse meetings cancelled by a newly configured event', async () => {
    const route = routeFixture(true, [{ data: '2030-01-13', tipo: 'Assembleia' }]);
    const result = await route.POST({ json: async () => ({ semana: '2030-01-07', reuniao_ids: [910001, 910002] }) });
    assert.equal(result.status, 400);
});

test('suggestion endpoint requires edit permissions', async () => {
    const route = routeFixture(false);
    const result = await route.POST({ json: async () => ({ semana: '2030-01-07', reuniao_ids: [910001, 910002] }) });
    assert.equal(result.status, 403);
    assert.equal(route.calls.length, 0);
});

test('invalid draft types are rejected instead of replacing manual selections', async () => {
    const route = routeFixture();
    const result = await route.POST({ json: async () => ({
        semana: '2030-01-07', reuniao_ids: [910001, 910002],
        assignments: [{ reuniao_id: 910001, tipo_id: 999999, publicador_id: 900001 }]
    }) });
    assert.equal(result.status, 400);
});
