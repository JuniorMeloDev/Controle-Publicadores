import assert from 'node:assert/strict';
import test from 'node:test';
import { generateFieldSchedule, validateImportedHistory } from '../app/lib/field-planner.js';
import { mutateFieldService } from '../app/lib/field-service-server.js';

const territory = (id, periodo = 'ambos', ultima_conclusao = null) => ({ id, numero: id, periodo, ativo: true, ultima_conclusao });
const snapshot = (overrides = {}) => ({ territorios: [territory(1, 'semana'), territory(2, 'fim_semana'), territory(3)], designacoes: [], saidas: [], ...overrides });
const config = (overrides = {}) => ({ inicio: '2026-11-04', fim: '2026-11-07', intervalo: 14,
  regras: [{ dia: 3, horario: '08:30', quantidade: 1 }, { dia: 6, horario: '08:30', quantidade: 1 }], ...overrides });

test('weekend suggestions follow map ownership and allow separate groups at the same time', () => {
  const state = snapshot({ territorios: [
    { ...territory(1), mapa_grupo_id: 10 },
    { ...territory(2), mapa_grupo_id: 20 },
    { ...territory(3), mapa_grupo_id: null },
  ] });
  const result = generateFieldSchedule(state, config({ inicio: '2026-11-07', fim: '2026-11-08', regras: [
    { dia: 6, horario: '08:30', quantidade: 1, grupos: [10] },
    { dia: 6, horario: '08:30', quantidade: 1, grupos: [20] },
    { dia: 0, horario: '08:30', quantidade: 1, grupos: [30] },
  ] }));
  assert.deepEqual(result.rows.map(row => row.territorios), [[1], [2], []]);
  assert.equal(result.warnings.length, 1);
  const weekday = generateFieldSchedule(state, config({ regras: [{ dia: 3, horario: '08:30', quantidade: 3, grupos: [10] }] }));
  assert.deepEqual(weekday.rows[0].territorios, [1, 2, 3]);
  const congregation = generateFieldSchedule(state, config({ regras: [{ dia: 6, horario: '08:30', quantidade: 3, grupos: [] }] }));
  assert.deepEqual(congregation.rows[0].territorios, [1, 2, 3]);
  const combined = generateFieldSchedule(state, config({ regras: [{ dia: 6, horario: '08:30', quantidade: 3, grupos: [10, 20] }] }));
  assert.deepEqual(combined.rows[0].territorios, [1, 2]);
});

test('batch saving rechecks territory ownership when the map changes after preview', async () => {
  let inserts = 0;
  const client = { query: async sql => {
    if (sql.startsWith('SELECT id, periodo, mapa_grupo_id')) return { rows: [{ id: 1, periodo: 'ambos', mapa_grupo_id: 20 }] };
    if (sql.startsWith('INSERT')) inserts++;
    return { rows: [] };
  } };
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'batch', records: [{
    data: '2026-11-07', horario: '08:30', modalidade: 'territorio', grupos: [10], territorios: [1],
  }] }), error => error.status === 409 && /grupo responsável/i.test(error.message));
  assert.equal(inserts, 0);
});

test('schedule respects weekday pools, prioritizes oldest history and leaves leaders unassigned', () => {
  const { rows } = generateFieldSchedule(snapshot(), config());
  assert.deepEqual(rows.map(r => r.territorios), [[1], [2]]);
  assert.ok(rows.every(row => row.dirigente_publicador_id === null));
  const older = snapshot({ territorios: [territory(1, 'ambos', '2026-09-01'), territory(2, 'ambos', '2026-08-01'), territory(3)] });
  const result = generateFieldSchedule(older, config({ regras: [{ dia: 3, horario: '08:30', quantidade: 2 }] }));
  assert.deepEqual(result.rows[0].territorios, [3, 2]);
});

test('schedule excludes pending and inactive territories, avoids reservations and warns of shortages', () => {
  const state = snapshot({ territorios: [territory(1), { ...territory(2), ativo: false }, territory(3)],
    designacoes: [{ territorio_id: 1, data_conclusao: null }],
    saidas: [{ data: '2026-11-08', horario: '15:00', grupos: [2], territorios: [3] }] });
  const result = generateFieldSchedule(state, config());
  assert.ok(result.rows.every(row => row.territorios.length === 0));
  assert.equal(result.warnings.length, 2);
  const repeating = generateFieldSchedule(snapshot({ territorios: [territory(1)] }), config({ fim: '2026-11-18', regras: [{ dia: 3, horario: '08:30', quantidade: 1 }] }));
  assert.deepEqual(repeating.rows.map(r => r.territorios), [[1], [], [1]]);
});

test('schedule skips conflicting groups and validates range and quantities', () => {
  const state = snapshot({ saidas: [{ data: '2026-11-04', horario: '08:30', grupos: [], territorios: [] }] });
  const result = generateFieldSchedule(state, config());
  assert.equal(result.rows.length, 1);
  assert.match(result.warnings[0], /já existe/);
  for (const change of [{ fim: '2026-11-01' }, { fim: '2027-11-01' }, { intervalo: 0 }, { regras: [] }, { regras: [{ dia: 7, quantidade: 1 }] }]) assert.throws(() => generateFieldSchedule(snapshot(), config(change)));
});

test('historical records keep original names and require complete valid dates', () => {
  const record = { territorio_id: 4, responsavel_nome: 'Visita', data_designacao: '2026-10-28', data_conclusao: '2026-10-28' };
  const result = validateImportedHistory(record);
  assert.equal(result.publicador_id, null);
  assert.equal(result.responsavel_nome, 'Visita');
  assert.throws(() => validateImportedHistory({ ...record, data_designacao: '' }));
  assert.throws(() => validateImportedHistory({ ...record, data_conclusao: '2026-10-27' }));
  assert.throws(() => validateImportedHistory({ ...record, data_conclusao: '2026-02-30' }));
});

test('a result for each of four selected territories creates four independent conclusions', async () => {
  let nextId = 100;
  const calls = [];
  const client = { query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT *, data::text AS data FROM campo_saidas')) return { rows: [{ id: 5, data: '2026-11-07', modalidade: 'territorio', dirigente_publicador_id: 9, territorios: [1, 2, 3, 4] }] };
    if (sql.includes('WHERE id = ANY')) return { rows: params[0].map(id => ({ id, ativo: true })) };
    if (sql.startsWith('INSERT')) return { rows: [{ id: nextId++ }] };
    return { rows: [] };
  } };
  const result = await mutateFieldService(client, { entity: 'saidas', action: 'result', id: 5, data: '2026-11-07',
    resultados: [1, 2, 3, 4].map(territorio_id => ({ territorio_id, resultado: 'concluido' })) });
  assert.equal(result.resultados, 4);
  const deliveries = calls.filter(c => c.sql.startsWith('INSERT INTO campo_designacoes'));
  assert.equal(deliveries.length, 4);
  assert.deepEqual(deliveries.map(c => c.params[0]), [1, 2, 3, 4]);
  assert.ok(deliveries.every(c => c.params[3] === '2026-11-07'));
});

test('partial results require notes and results cannot include unrelated territories', async () => {
  const client = { query: async sql => ({ rows: sql.includes('FROM campo_saidas') ? [{ id: 5, data: '2026-11-07', modalidade: 'territorio', dirigente_publicador_id: 9, territorios: [1] }] : [] }) };
  for (const resultados of [[{ territorio_id: 1, resultado: 'parcial' }], [{ territorio_id: 9, resultado: 'concluido' }], [{ territorio_id: 1, resultado: 'invalid' }]]) {
    await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'result', id: 5, data: '2026-11-07', resultados }));
  }
});
