import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { getPublisherAssignments } = await loadModule('../../app/lib/publisher-assignments.js');
const fixtureAssignments = [
    { id: 'vida-940001', publicador_id: 900001, data_reuniao: '2030-01-10', nome_parte: 'Parte fictícia', categoria: 'Vida e Ministério', origem: 'vida_ministerio' },
    { id: 'mecanico-950001', publicador_id: 900001, data_reuniao: '2030-01-09', nome_parte: 'Volante', categoria: 'Privilégios Mecânicos', origem: 'privilegios_mecanicos' },
    { id: 'presidente-960001', publicador_id: 900001, data_reuniao: '2030-01-13', nome_parte: 'Presidente do discurso público', categoria: 'Discursos Públicos', origem: 'discursos_publicos' },
    { id: 'limpeza-970001-900001', publicador_id: 900001, data_reuniao: '2030-01-12', nome_parte: 'Limpeza semanal', categoria: 'Limpeza Semanal', origem: 'limpeza_semanal' }
];

test('unified history reads all assignment sources with parameterized filters', async () => {
    let query;
    let params;
    const rows = await getPublisherAssignments({ query: async (sql, values) => {
        query = sql; params = values; return { rows: fixtureAssignments };
    } }, { publisherId: 900001, futureOnly: true, since: '2029-01-01' });
    assert.equal(rows.length, 4);
    for (const table of ['designacoes_reuniao', 'reunioes_privilegios', 'discursos_publicos', 'limpeza_semanal']) assert.ok(query.includes(table));
    assert.match(query, /America\/Sao_Paulo/);
    assert.match(query, /a.publicador_id = \$1/);
    assert.match(query, /a.data_reuniao >= \$2::date/);
    assert.deepEqual(params, [900001, '2029-01-01']);
});

test('future summary returns mechanical, speech and cleaning assignments', async () => {
    let options;
    const route = loadRoute('../../app/api/admin/get-designacoes-publicador/route.js', {
        Pool: class { connect() { return { query: async () => ({ rows: [{ nome_completo: 'Publicador Fictício Alfa', nome_chamado: 'Fictício Alfa' }] }), release() {} }; } },
        getPublisherAssignments: async (_client, input) => { options = input; return fixtureAssignments; }
    });
    const result = await route.GET({ url: 'http://example.test/api?id=900001' });
    assert.equal(result.status, 200);
    assert.equal(result.body.assignments.length, 4);
    assert.equal(options.futureOnly, true);
    assert.equal(options.publisherId, '900001');
});

test('publisher timeline combines all assignment types and profile changes in date order', async () => {
    const route = loadRoute('../../app/api/admin/get-historico/[id]/route.js', {
        Pool: class { connect() { return { query: async () => ({ rows: [{ id: 980001, data_evento: '2029-01-01', tipo_evento: 'pessoal', campo_alterado: 'telefone' }] }), release() {} }; } },
        getPublisherAssignments: async () => fixtureAssignments
    });
    const result = await route.GET({}, { params: Promise.resolve({ id: '900001' }) });
    assert.equal(result.body.length, 5);
    assert.equal(result.body[0].id, 'presidente-960001');
    assert.equal(result.body.filter(a => a.tipo_evento === 'designacao').length, 4);
    assert.equal(new Set(result.body.map(a => a.id)).size, 5);
});
