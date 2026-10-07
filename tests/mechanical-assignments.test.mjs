import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-source.mjs';

const { getWeekStart, suggestMechanicalAssignments } = await loadModule('../../app/lib/mechanical-assignments.js');

// All people, IDs, dates and assignments in these fixtures are fictitious.
const publishers = [
    { id: 900001, nome_completo: 'Publicador Fictício Alfa', sexo: 'Masculino', data_batismo: '2000-01-01', privilegios: [] },
    { id: 900002, nome_completo: 'Publicador Fictício Beta', sexo: 'Masculino', data_batismo: '2000-01-01', privilegios: [] },
    { id: 900003, nome_completo: 'Publicador Fictício Gama', sexo: 'Masculino', data_batismo: '2000-01-01', privilegios: ['anciao'] },
    { id: 900004, nome_completo: 'Publicador Fictício Delta', sexo: 'Masculino', data_batismo: '2000-01-01', privilegios: ['anciao'] }
];
const meetings = [
    { id: 910001, data: '2030-01-09', tipo: 'Meio de Semana' },
    { id: 910002, data: '2030-01-13', tipo: 'Fim de Semana' }
];
const types = [{ id: 920001, nome: 'Volante', ativo: true, ordem: 0 }];
const entry = (id, date, origin = 'vida_ministerio') => ({ publicador_id: id, data_reuniao: date, origem: origin });
const suggest = options => suggestMechanicalAssignments({ meetings: [meetings[0]], types, publishers: publishers.slice(0, 2), history: [], ...options });

test('week boundaries use Monday through Sunday, including Date objects', () => {
    assert.equal(getWeekStart('2030-01-13'), '2030-01-07');
    assert.equal(getWeekStart(new Date('2030-01-09T03:00:00Z')), '2030-01-07');
    assert.equal(getWeekStart('2030-01-06'), '2029-12-31');
});

test('the oldest last assignment wins across all activity types', () => {
    const result = suggest({ history: [entry(900001, '2029-09-01', 'limpeza_semanal'), entry(900002, '2029-12-01', 'discursos_publicos')] });
    assert.equal(result.assignments[0].publicador_id, 900001);
});

test('a never assigned publisher has priority over someone with old history', () => {
    const result = suggest({ history: [entry(900001, '2020-01-01')] });
    assert.equal(result.assignments[0].publicador_id, 900002);
});

test('future assignments after the selected week do not distort recency', () => {
    const result = suggest({ history: [entry(900001, '2029-09-01'), entry(900001, '2030-06-01'), entry(900002, '2029-12-01')] });
    assert.equal(result.assignments[0].publicador_id, 900001);
});

test('publishers already booked in the week are avoided', () => {
    const result = suggest({ history: [entry(900001, '2030-01-10')] });
    assert.equal(result.assignments[0].publicador_id, 900002);
});

test('manual choices are preserved and never duplicated at another meeting', () => {
    const assignments = [{ reuniao_id: meetings[0].id, tipo_id: types[0].id, publicador_id: 900001 }];
    const result = suggest({ meetings, assignments });
    assert.equal(result.assignments[0].publicador_id, 900001);
    assert.equal(result.assignments[1].publicador_id, 900002);
    assert.equal(assignments.length, 1);
});

test('saved mechanical choices in this week are replaced by the supplied draft', () => {
    const result = suggest({ history: [{ ...entry(900001, meetings[0].data, 'privilegios_mecanicos'), reuniao_id: meetings[0].id }] });
    assert.equal(result.assignments[0].publicador_id, 900001);
});

test('elders are allocated to elder roles before general roles', () => {
    const result = suggest({
        publishers: publishers.slice(0, 3),
        types: [...types, { id: 920002, nome: 'Ancião de Apoio', ativo: true, ordem: 1 }]
    });
    assert.equal(result.assignments.find(a => a.tipo_id === 920002).publicador_id, 900003);
    assert.notEqual(result.assignments.find(a => a.tipo_id === 920001).publicador_id, 900003);
});

test('reader is omitted at midweek meetings and inactive types are omitted', () => {
    const result = suggest({ meetings, types: [
        { id: 920003, nome: 'Leitor de A Sentinela', ativo: true, ordem: 0 },
        { id: 920004, nome: 'Privilégio inativo fictício', ativo: false, ordem: 1 }
    ] });
    assert.equal(result.assignments.length, 1);
    assert.equal(result.assignments[0].reuniao_id, meetings[1].id);
});

test('ineligible and unbaptized candidates are excluded from automatic suggestions', () => {
    const result = suggest({ publishers: [
        { ...publishers[0], sexo: 'Feminino' }, { ...publishers[1], data_batismo: null }
    ] });
    assert.equal(result.assignments.length, 0);
    assert.equal(result.unfilled.length, 1);
});

test('shortages leave empty fields with feedback rather than duplicate people', () => {
    const result = suggest({ meetings, publishers: [publishers[0]] });
    assert.equal(result.assignments.length, 1);
    assert.equal(result.unfilled.length, 1);
});
