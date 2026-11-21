import assert from 'node:assert/strict';
import test from 'node:test';
import { transferFieldAssignment } from '../app/lib/field-service-transfer.js';
import { assignmentContinuationNotes, isFieldOutingCompleted } from '../app/lib/field-service.js';

const previous = { id: 10, territorio_id: 12, publicador_id: 1, data_designacao: '2026-11-14', data_conclusao: null, data_transferencia: null };
const input = { id: 10, publicador_id: 2, data_transferencia: '2026-11-21' };
function fixture(row = previous, latest = { data: '2026-11-14', resultado: 'parcial', observacoes: 'Faltam as quadras 3 e 4.' }) {
  const calls = [];
  return { calls, client: { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FOR UPDATE')) return { rows: row ? [row] : [] };
    if (sql.includes('FROM campo_saida_resultados')) return { rows: latest ? [latest] : [] };
    return { rows: [] };
  } } };
}

test('transfer closes responsibility without a conclusion and carries the latest pending work', async () => {
  const { client, calls } = fixture();
  const result = await transferFieldAssignment(client, input, async (_client, payload) => {
    assert.equal(payload.record.territorio_id, 12);
    assert.equal(payload.record.publicador_id, 2);
    assert.equal(payload.record.data_designacao, '2026-11-21');
    assert.equal(payload.record.data_conclusao, undefined);
    return { id: 11, ids: [11] };
  });
  assert.equal(result.transferencia.designacao_anterior_id, 10);
  assert.equal(result.transferencia.orientacoes_continuacao, 'Faltam as quadras 3 e 4.');
  assert.deepEqual(calls.find(c => c.sql.startsWith('UPDATE campo_designacoes SET data_transferencia')).params, [10, '2026-11-21']);
  assert.deepEqual(calls.find(c => c.sql.includes('SET designacao_anterior_id')).params, [11, 10, 'Faltam as quadras 3 e 4.']);
  assert.ok(!calls.some(c => c.sql.includes('SET data_conclusao')));
});

test('completed, stale, mismatched and backdated transfers fail before any update', async () => {
  for (const [row, values, latest] of [
    [null, input, null],
    [{ ...previous, data_conclusao: '2026-11-15' }, input, null],
    [{ ...previous, data_transferencia: '2026-11-20' }, input, null],
    [previous, { ...input, territorio_id: 13 }, null],
    [previous, { ...input, data_transferencia: '2026-11-13' }, null],
    [previous, input, { data: '2026-11-22' }],
  ]) {
    const { client, calls } = fixture(row, latest);
    await assert.rejects(transferFieldAssignment(client, values, () => assert.fail('Should not create an assignment')));
    assert.ok(!calls.some(c => c.sql.startsWith('UPDATE')));
  }
});

test('a subsequent handover keeps inherited notes until newer partial work replaces them', async () => {
  const inherited = { ...previous, orientacoes_continuacao: 'Falta a rua 2.' };
  const { client } = fixture(inherited, null);
  const result = await transferFieldAssignment(client, input, async () => ({ id: 11, ids: [11] }));
  assert.equal(result.transferencia.orientacoes_continuacao, inherited.orientacoes_continuacao);
  assert.equal(assignmentContinuationNotes(inherited), 'Falta a rua 2.');
  assert.equal(assignmentContinuationNotes(inherited, [{ id: 1, designacao_id: 10, resultado: 'parcial', data: '2026-11-20', observacoes: 'Falta apenas a casa 5.' }]), 'Falta apenas a casa 5.');
});

test('transferred work leaves the old agenda without creating a completed assignment', () => {
  const outing = { id: 3, modalidade: 'territorio', territorios: [12] };
  const transfer = { ...previous, data_transferencia: '2026-11-21', observacoes: 'Entrega registrada pela saída 3.' };
  assert.equal(isFieldOutingCompleted(outing, [transfer]), true);
  assert.equal(transfer.data_conclusao, null);
  assert.equal(isFieldOutingCompleted({ ...outing, id: 4 }, [transfer]), false);
});
