import assert from 'node:assert/strict';
import test from 'node:test';
import { territoryBoundaryProposal } from '../app/lib/territory-boundary-proposals.js';
import { validateBoundary, checkBoundaryPlacement } from '../app/lib/territory-boundaries.js';
import { territoryBoundaryProposals, proposalGeneralReference } from '../app/lib/territory-boundary-proposal-data.js';
import { saveTerritoryBoundary } from '../app/lib/territory-boundaries-server.js';

const neighbor = { numero: 1, ativo: true, limites: { type: 'Polygon', coordinates: [[
  [-34.91775076356682, -8.208709576993707],
  [-34.91793047157082, -8.209436971949009],
  [-34.91834621396813, -8.210355505281111],
  [-34.9196014877871, -8.210026320230128],
  [-34.919161605508656, -8.208306058110622],
  [-34.91845618453774, -8.208486579763699],
  [-34.91775076356682, -8.208709576993707]
]] } };
const territory = { numero: 2, ativo: true, limites: null, pdf_hash: '6f2255f2f3acd7778c9b2a7a1ef85dff' };

test('card 2 proposal is valid and shares the saved side of territory 1 without overlap', () => {
  const proposal = territoryBoundaryProposal(territory, [neighbor]);
  assert.ok(proposal);
  const boundary = validateBoundary(proposal.limites);
  const general = { type: 'Polygon', coordinates: [[[-34.93,-8.22],[-34.91,-8.22],[-34.91,-8.20],[-34.93,-8.20],[-34.93,-8.22]]] };
  checkBoundaryPlacement(boundary, general, [neighbor]);
  const ring = boundary.coordinates[0];
  assert.ok(ring.some((point, index) => JSON.stringify(point) === JSON.stringify(neighbor.limites.coordinates[0][4])
    && JSON.stringify(ring[index + 1]) === JSON.stringify(neighbor.limites.coordinates[0][3])));
  assert.equal(territory.limites, null);
});

test('all 30 drafts fit the reference boundary and only the explicitly disputed pair overlaps', () => {
  assert.deepEqual(Object.keys(territoryBoundaryProposals).map(Number), Array.from({ length: 30 }, (_, index) => index + 2));
  for (const [number, proposal] of Object.entries(territoryBoundaryProposals)) {
    assert.match(proposal.pdf_hash, /^[a-f0-9]{32}$/);
    assert.equal(proposal.divisas.length, 4);
    const boundary = validateBoundary(proposal.limites);
    checkBoundaryPlacement(boundary, proposalGeneralReference, [neighbor]);
    const territory = { numero: Number(number), ativo: true, limites: null, pdf_hash: proposal.pdf_hash };
    assert.ok(territoryBoundaryProposal(territory, [neighbor]));
    for (const [otherNumber, other] of Object.entries(territoryBoundaryProposals)) {
      if (Number(otherNumber) >= Number(number)) continue;
      if (number === '20' && otherNumber === '19') {
        assert.throws(() => checkBoundaryPlacement(boundary, proposalGeneralReference, [{ numero: 19, limites: other.limites }]), /sobrepõe/);
      } else checkBoundaryPlacement(boundary, proposalGeneralReference, [{ numero: otherNumber, limites: other.limites }]);
    }
  }
});

test('unresolved card 19/20 overlap cannot be published even when neither territory is saved', async () => {
  const rows = [{ ...neighbor, id: 1, mapa_revisao: 1 }, ...[19, 20].map(numero => ({
    id: numero, numero, ativo: true, limites: null, mapa_revisao: 0, pdf_hash: territoryBoundaryProposals[numero].pdf_hash
  }))];
  const calls = [];
  const client = { async query(sql) {
    calls.push(sql);
    if (sql.includes('FROM campo_mapa_geral')) return { rows: [{ limites: proposalGeneralReference, revisao: 0 }] };
    if (sql.includes('FROM campo_territorios')) return { rows };
    return { rows: [] };
  } };
  for (const number of [19, 20]) {
    await assert.rejects(saveTerritoryBoundary(client, {
      territorio: number, revisao: 0, limites: territoryBoundaryProposals[number].limites
    }), /faixa comum dos cartões 19 e 20/);
  }
  assert.ok(!calls.some(sql => sql.startsWith('UPDATE')));
});

test('proposal is unavailable after publication, PDF replacement, neighbor changes or for other territories', () => {
  for (const change of [{ numero: 3 }, { ativo: false }, { limites: neighbor.limites }, { pdf_hash: 'replaced' }]) {
    assert.equal(territoryBoundaryProposal({ ...territory, ...change }, [neighbor]), null);
  }
  assert.equal(territoryBoundaryProposal(territory, []), null);
  const changed = structuredClone(neighbor);
  changed.limites.coordinates[0][4][0] += 0.00001;
  assert.equal(territoryBoundaryProposal(territory, [changed]), null);
  assert.equal(territoryBoundaryProposal(territory, [{ ...neighbor, ativo: false }]), null);
});
