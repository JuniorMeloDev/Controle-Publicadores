import test from 'node:test';
import assert from 'node:assert/strict';
import area from '@turf/area';
import { polygon } from '@turf/helpers';
import { boundaryOverlap, removeBoundaryOverlap } from '../app/lib/territory-boundary-conflicts.js';
import { checkBoundaryPlacement, validateBoundary } from '../app/lib/territory-boundaries.js';
import { territoryBoundaryProposals, proposalGeneralReference } from '../app/lib/territory-boundary-proposal-data.js';
import { saveTerritoryBoundary } from '../app/lib/territory-boundaries-server.js';
import { readFileSync } from 'node:fs';
import { fitBoundaryToGeneral, repairBoundaryCrossings, firstBoundaryConflict } from '../app/lib/territory-boundary-conflicts.js';
import { territoryReferenceOptions } from '../app/lib/territory-reference-selection.js';
const legacy19 = JSON.parse(readFileSync(new URL('./fixtures/territory-19-legacy-boundary.json', import.meta.url)));

test('either choice for the 19/20 strip removes only the duplicate area and can be published in sequence', async () => {
  for (const [selected, peer] of [[19, 20], [20, 19]]) {
    const current = structuredClone(selected === 19 ? legacy19 : territoryBoundaryProposals[selected].limites);
    const neighbor = structuredClone(peer === 19 ? legacy19 : territoryBoundaryProposals[peer].limites);
    const originalNeighbor = structuredClone(neighbor);
    const original = structuredClone(current);
    const overlap = boundaryOverlap(current, neighbor);
    assert.ok(overlap);
    const adjusted = removeBoundaryOverlap(current, neighbor);
    assert.equal(boundaryOverlap(adjusted, neighbor), null);
    checkBoundaryPlacement(adjusted, proposalGeneralReference, [{ numero: peer, limites: neighbor }]);
    assert.ok(Math.abs(area(polygon(current.coordinates)) - area(polygon(adjusted.coordinates)) - area(overlap)) < 0.1);
    assert.deepEqual(current, original);
    assert.deepEqual(neighbor, originalNeighbor);

    const rows = [{ id: 1, numero: 1, ativo: true, limites: { type: 'Polygon', coordinates: [[
      [-34.91775076356682, -8.208709576993707], [-34.91793047157082, -8.209436971949009],
      [-34.91834621396813, -8.210355505281111], [-34.9196014877871, -8.210026320230128],
      [-34.919161605508656, -8.208306058110622], [-34.91845618453774, -8.208486579763699],
      [-34.91775076356682, -8.208709576993707]
    ]] } }, ...[19, 20].map(numero => ({ id: numero, numero, ativo: true, limites: null,
      mapa_revisao: 0, pdf_hash: territoryBoundaryProposals[numero].pdf_hash }))];
    const updates = [];
    const client = { async query(sql, values) {
      if (sql.includes('FROM campo_mapa_geral')) return { rows: [{ limites: proposalGeneralReference, revisao: 0 }] };
      if (sql.includes('FROM campo_territorios')) return { rows };
      if (sql.startsWith('UPDATE campo_territorios')) {
        updates.push(values[0]);
        const row = rows.find(row => row.id === values[0]);
        row.limites = JSON.parse(values[1]); row.mapa_revisao += 1;
      }
      return { rows: [] };
    } };
    await saveTerritoryBoundary(client, { territorio: selected, revisao: 0, limites: adjusted });
    await saveTerritoryBoundary(client, { territorio: peer, revisao: 0, limites: neighbor });
    assert.deepEqual(updates, [selected, peer]);
  }
});

test('an outside draft can be clipped to the general boundary without changing either input', () => {
  const boundary = square(-35, -9, 0.02);
  const general = square(-34.99, -9.01, 0.02);
  const original = structuredClone(boundary);
  assert.throws(() => checkBoundaryPlacement(boundary, general), /limite geral/);
  const fitted = fitBoundaryToGeneral(boundary, general);
  checkBoundaryPlacement(fitted, general);
  assert.deepEqual(boundary, original);
  assert.throws(() => fitBoundaryToGeneral(boundary, square(-34, -9, 0.01)), /território único/);
});

const square = (x, y, size) => ({ type: 'Polygon', coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] });

test('disjoint boundaries are unchanged and cuts creating holes or separate pieces are rejected', () => {
  const current = square(-35, -9, 0.01);
  assert.equal(boundaryOverlap(null, current), null);
  assert.equal(boundaryOverlap(current, square(-34, -9, 0.01)), null);
  assert.deepEqual(removeBoundaryOverlap(current, square(-34, -9, 0.01)), current);
  assert.throws(() => removeBoundaryOverlap(current, current), /dividiria/);
  assert.throws(() => removeBoundaryOverlap(current, square(-34.998, -8.998, 0.002)), /buraco/);
  const split = { type: 'Polygon', coordinates: [[[-34.996,-9.01],[-34.994,-9.01],[-34.994,-8.98],[-34.996,-8.98],[-34.996,-9.01]]] };
  assert.throws(() => removeBoundaryOverlap(current, split), /dividiria/);
});

test('crossing repair preserves all distinct vertices and restores territory references', () => {
  const crossed = structuredClone(territoryBoundaryProposals[19].limites);
  const ring = crossed.coordinates[0];
  [ring[3], ring[12]] = [ring[12], ring[3]];
  const original = structuredClone(crossed);
  assert.throws(() => validateBoundary(crossed), /cruzamentos/);
  assert.throws(() => territoryReferenceOptions(crossed), /cruzad/);
  const repaired = repairBoundaryCrossings(crossed);
  validateBoundary(repaired);
  assert.deepEqual(new Set(repaired.coordinates[0].map(p => p.join(','))), new Set(ring.map(p => p.join(','))));
  assert.deepEqual(crossed, original);
  assert.ok(territoryReferenceOptions(repaired).length > 0);
});

test('crossing repair handles a bow tie and duplicates, rejects degenerate or malformed geometry', () => {
  const crossed = { type: 'Polygon', coordinates: [[[-35,-9],[-34.99,-8.99],[-34.99,-9],[-35,-8.99],[-35,-9]]] };
  const repaired = repairBoundaryCrossings(crossed);
  assert.equal(repaired.coordinates[0].length, 5);
  const duplicate = structuredClone(repaired);
  duplicate.coordinates[0].splice(1, 0, [...duplicate.coordinates[0][0]]);
  assert.deepEqual(repairBoundaryCrossings(duplicate), repaired);
  assert.throws(() => repairBoundaryCrossings(null));
  assert.throws(() => repairBoundaryCrossings({type:'Polygon',coordinates:[[[0,0],[1,0],[2,0],[0,0]]]}));
  assert.throws(() => repairBoundaryCrossings({type:'Polygon',coordinates:[[[0,0],[Infinity,0],[2,1],[0,0]]]}));
});

test('territory 28 detects and fits the narrow strip created by the saved territory 24 border', () => {
  const saved24 = structuredClone(territoryBoundaryProposals[24].limites);
  const edits = new Map([
    [-34.9263324, [-34.92633239999999,-8.20440225684264]],
    [-34.9264021, [-34.926402100000004,-8.20439249736939]],
    [-34.9265067, [-34.92650669999999,-8.2043951189474]]
  ]);
  saved24.coordinates[0] = saved24.coordinates[0].map(p => edits.get(p[0]) || p);
  const peer = { id: 324, numero: 24, limites: saved24 };
  const original = structuredClone(peer);
  const boundary = territoryBoundaryProposals[28].limites;
  const conflict = firstBoundaryConflict(boundary, [{ id: 999, numero: 99, limites: null }, peer]);
  assert.equal(conflict.territory.id, 324);
  assert.ok(Math.abs(conflict.areaM2 - 74.6665) < 0.1);
  assert.ok(conflict.percentage < 0.06);
  const adjusted = removeBoundaryOverlap(boundary, saved24);
  assert.equal(firstBoundaryConflict(adjusted, [peer]), null);
  checkBoundaryPlacement(adjusted, proposalGeneralReference, [peer]);
  assert.deepEqual(peer, original);
  assert.equal(firstBoundaryConflict(null, [peer]), null);
});
