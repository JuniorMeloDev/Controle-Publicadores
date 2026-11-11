import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const summary = await loadModule('../../app/lib/life-ministry-summary.js');
const { getPartTitles } = await loadModule('../../app/lib/life-ministry-parts.js');
const schedule = {
    openingComments: 'Comentários iniciais (1 min)', finalComments: 'Comentários finais (3 min)', middleSong: 'Cântico 2',
    treasures: [{ title: 'Leitura da Bíblia (4 min)' }],
    ministry: [{ title: 'Conversa (3 min)' }, { title: 'Discurso (5 min)' }],
    living: [{ title: 'Estudo bíblico de congregação (30 min)' }, { title: 'Necessidades locais (15 min)' }],
};
const titles = getPartTitles(schedule);
const assignments = Object.fromEntries(Object.keys(titles).map(key => [key, `Pessoa ${key}`]));
const rows = Object.entries(titles).map(([key, nome_parte]) => ({ nome_parte, nome_completo: assignments[key] }));

test('saved summaries have the same completion as an opened week, including students and Bible study reader', () => {
    const result = summary.getLifeMinistrySummary(schedule, rows);
    assert.equal(result.total, 13); assert.equal(result.filled, 13); assert.equal(result.percentage, 100);
    assert.equal(result.presidente, assignments.presidente);
    assert.equal(result.leitorBiblia, assignments.tesouro_0);
    const loaded = summary.getWeekCompletionStats(schedule, assignments);
    assert.deepEqual({ total: result.total, filled: result.filled, percentage: result.percentage }, loaded);
});

test('empty, partial and external assignments are reflected before opening the meeting', () => {
    assert.equal(summary.getLifeMinistrySummary(null), null);
    assert.equal(summary.getLifeMinistrySummary(schedule).filled, 0);
    assert.equal(summary.getLifeMinistrySummary(schedule, rows.slice(0, -1)).filled, 12);
    const external = { ...schedule, participantes_externos: [{ parte_id: 'tesouro_0', nome_parte: titles.tesouro_0, nome_completo: 'Participante externo' }] };
    const result = summary.getLifeMinistrySummary(external);
    assert.equal(result.filled, 1); assert.equal(result.leitorBiblia, 'Participante externo');
});

test('meeting directory returns completion for every saved week in its initial response', async () => {
    let calls = 0;
    const route = loadRoute('../../app/api/admin/get-reunioes/route.js', {
        ...summary,
        getCalendarContext: async () => ({}), withCalendarState: row => row,
        Pool: class { connect() { return { query: async () => {
            calls++;
            return { rows: [
                { data_reuniao: '2026-11-04', tem_programacao: true, programacao: schedule, designacoes: rows },
                { data_reuniao: '2026-11-11', tem_programacao: true, programacao: schedule, designacoes: rows },
                { data_reuniao: '2026-11-18', tem_programacao: true, programacao: schedule, designacoes: [] },
                { data_reuniao: '2026-11-25', tem_programacao: false, programacao: null, designacoes: null },
            ] };
        }, release() {} }; } },
    });
    const response = await route.GET({});
    assert.equal(response.status, 200); assert.equal(calls, 1);
    assert.equal(response.body[0].preenchimento.percentage, 100);
    assert.equal(response.body[1].preenchimento.percentage, 100);
    assert.equal(response.body[2].preenchimento.filled, 0);
    assert.equal(response.body[3].preenchimento, null);
    assert.ok(response.body.every(row => !Object.hasOwn(row, 'programacao') && !Object.hasOwn(row, 'designacoes')));
});
