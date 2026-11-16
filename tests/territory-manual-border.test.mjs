import test from 'node:test';
import assert from 'node:assert/strict';
import { saveTerritoryBoundary } from '../app/lib/territory-boundaries-server.js';
import { territoryBoundaryProposals, proposalGeneralReference } from '../app/lib/territory-boundary-proposal-data.js';
import { territoryReferenceOptions } from '../app/lib/territory-reference-selection.js';

const boundary = territoryBoundaryProposals[19].limites;
function fixture({ numero = 19, other = 18, general = proposalGeneralReference } = {}) {
  const calls = [];
  const rows = [{ id: 123, numero, ativo: true, limites: null, mapa_revisao: 0, mapa_layout_revisao: 0 },
    { id: 456, numero: other, ativo: true, limites: boundary, mapa_revisao: 1 }];
  return { calls, async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('FROM campo_mapa_geral')) return { rows: [{ limites: general, revisao: 0 }] };
    if (sql.includes('FROM campo_territorios')) return { rows };
    return { rows: [] };
  } };
}
const payload = { territorio: 123, revisao: 0, limites: boundary, confirmar_divisa_com_18: true };

test('manual confirmation saves the exact territory 19 outline and references, leaving 18 untouched', async () => {
  const client = fixture();
  const ids = territoryReferenceOptions(boundary).slice(0, 2).map(option => option.id);
  const result = await saveTerritoryBoundary(client, { ...payload, referencia_ids: ids, desenho_revisao: 0 });
  const updates = client.calls.filter(call => call.sql.startsWith('UPDATE'));
  assert.equal(updates.length, 1);
  assert.equal(updates[0].values[0], 123);
  assert.deepEqual(JSON.parse(updates[0].values[1]), boundary);
  assert.deepEqual(JSON.parse(updates[0].values[3]).selectedReferenceIds, ids);
  assert.equal(result.divisa_18_confirmada, true);
});

test('manual confirmation is restricted to 19/18 and still validates the congregation boundary', async () => {
  for (const [client, body, message] of [
    [fixture(), { ...payload, confirmar_divisa_com_18: false }, /sobrepõe/],
    [fixture(), { ...payload, confirmar_divisa_com_18: 'true' }, /sobrepõe/],
    [fixture({ numero: 20 }), payload, /sobrepõe/],
    [fixture({ other: 17 }), payload, /sobrepõe/],
    [fixture({ general: { type: 'Polygon', coordinates: [[[-35,-9],[-34.99,-9],[-34.99,-8.99],[-35,-8.99],[-35,-9]]] } }), payload, /limite geral/],
    [fixture(), { ...payload, revisao: 99 }, /Outra pessoa/]
  ]) {
    await assert.rejects(saveTerritoryBoundary(client, body), message);
    assert.equal(client.calls.some(call => call.sql.startsWith('UPDATE')), false);
  }
});
