import test from 'node:test';
import assert from 'node:assert/strict';
import { recentTerritoryWork } from '../app/lib/territory-recent-history.js';

test('recent territory work returns the last three distinct conclusions, with original and registered names', () => {
  const row = (id, end, extra = {}) => ({ territorio_id: id, data_conclusao: end, publicador_id: 2, ...extra });
  const data = { publicadores: [{ id: 2, nome: 'Dirigente cadastrado' }], designacoes: [
    row(1, '2026-08-01'), row(1, '2026-10-01', { responsavel_nome: 'Visita' }), row(1, null),
    row(2, '2026-11-04'), row(1, '2026-09-15'), row(1, '2026-10-20'),
    row(1, '2026-10-20', { responsavel_nome: 'Nome original' }), row(1, '2026-12-01')
  ] };
  assert.deepEqual(recentTerritoryWork(data, '1', '2026-11-04'), [
    { date: '2026-10-20', names: 'Dirigente cadastrado, Nome original' },
    { date: '2026-10-01', names: 'Visita' },
    { date: '2026-09-15', names: 'Dirigente cadastrado' }
  ]);
  assert.deepEqual(recentTerritoryWork(data, 3, '2026-11-04'), []);
  assert.equal(data.designacoes.length, 8);
});
