import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { getPartTitles, reconstructLifeMinistryAssignments } = await loadModule('../../app/lib/life-ministry-parts.js');
const schedule = {
    openingComments: 'Comentários iniciais (1 min)', middleSong: 'Cântico 17',
    treasures: [{ title: '1. Tesouro fictício (10 min): Instruções longas da apostila.' }],
    ministry: [
        { title: '4. INICIANDO CONVERSAS: (2 min) DE CASA EM CASA. (lição fictícia)' },
        { title: '5. INICIANDO CONVERSAS: (2 min) TESTEMUNHO INFORMAL. (lição fictícia)' },
        { title: '6. Discurso (5 min): Instruções fictícias.' }
    ],
    living: [{ title: '7. Estudo biblico de congregação (30 min): Instruções fictícias.' }]
};

function savedRows(fullTitles = false) {
    const titles = getPartTitles(schedule, !fullTitles);
    return Object.entries(titles).map(([key, nome_parte]) => ({ nome_parte, nome_completo: `Nome completo fictício ${key}`, nome_chamado: `Apelido ${key}` }));
}

test('export restores every saved short title, including both participants of repeated ministry parts', () => {
    const assignments = reconstructLifeMinistryAssignments(schedule, savedRows());
    for (const key of Object.keys(getPartTitles(schedule))) assert.equal(assignments[key], `Apelido ${key}`, key);
    assert.notEqual(assignments.ministerio_0_1, assignments.ministerio_1_1);
    assert.equal(assignments.vida_0_2, 'Apelido vida_0_2');
});

test('legacy full titles and mixed title formats are supported', () => {
    const rows = savedRows(true);
    rows[0].nome_chamado = '   ';
    rows.push({ nome_parte: 'Parte desconhecida', nome_completo: 'Pessoa fictícia' });
    const assignments = reconstructLifeMinistryAssignments(schedule, rows);
    assert.equal(assignments.presidente, 'Nome completo fictício presidente');
    assert.equal(assignments.ministerio_0_2, 'Apelido ministerio_0_2');
    const mixed = savedRows().map((row, index) => index % 2 ? savedRows(true)[index] : row);
    assert.equal(reconstructLifeMinistryAssignments(schedule, mixed).ministerio_1_2, 'Apelido ministerio_1_2');
});

test('an external student keeps the explicit slot and does not displace a registered assistant', () => {
    const titles = getPartTitles(schedule);
    const program = { ...schedule, participantes_externos: [{ parte_id: 'ministerio_0_1', nome_parte: titles.ministerio_0_1, nome_completo: 'Estudante externo fictício' }] };
    const rows = savedRows().filter(row => row.nome_chamado !== 'Apelido ministerio_0_1');
    const assignments = reconstructLifeMinistryAssignments(program, rows);
    assert.equal(assignments.ministerio_0_1, 'Estudante externo fictício');
    assert.equal(assignments.ministerio_0_2, 'Apelido ministerio_0_2');
});

test('meeting details API returns saved participants for export', async () => {
    const client = { query: async sql => sql.includes('reunioes_dados')
        ? { rows: [{ dados_json: schedule, descricao_texto: 'Semana fictícia' }] }
        : { rows: savedRows() }, release() {} };
    const route = loadRoute('../../app/api/admin/get-meeting-details/route.js', {
        Pool: class { connect() { return client; } }, reconstructLifeMinistryAssignments
    });
    const result = await route.GET({ url: 'http://example.test/api?date=2030-01-09' });
    assert.equal(result.status, 200);
    assert.equal(result.body.assignments.ministerio_0_1, 'Apelido ministerio_0_1');
    assert.equal(result.body.assignments.ministerio_1_2, 'Apelido ministerio_1_2');
    assert.equal(result.body.assignments.vida_0_1, 'Apelido vida_0_1');
});
