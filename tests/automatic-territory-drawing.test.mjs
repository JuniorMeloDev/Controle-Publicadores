import assert from 'node:assert/strict';
import test from 'node:test';
import { automaticTerritoryDrawing } from '../app/lib/automatic-territory-drawing.js';
import { validateEditableLayout, automaticReferenceGroups } from '../app/lib/editable-territory.js';
import { territoryBoundaryProposals } from '../app/lib/territory-boundary-proposal-data.js';
import { withTerritoryDrawing } from '../app/lib/territory-map-display.js';

const boundary = { type: 'Polygon', coordinates: [[[-35,-9],[-34.99,-9],[-34.99,-8.99],[-35,-8.99],[-35,-9]]] };
const dataset = {
  roads: [
    { id: 'west', name: 'Rua da Divisa', points: [[-35,-9],[-35,-8.99]] },
    { id: 'crossing', name: 'Rua Interna', points: [[-35.01,-8.995],[-34.98,-8.995]] },
    { id: 'outside', name: 'Rua de Fora', points: [[-36,-10],[-36,-9.9]] },
  ],
  landmarks: [
    { id: 'school', name: 'Escola dentro', kind: 'school', position: [-34.995,-8.995] },
    { id: 'outside', name: 'Comércio fora', kind: 'shop', position: [-34.98,-8.995] },
  ],
};

test('automatic cards use real outer and inner streets and include only references inside the boundary', () => {
  const drawing = automaticTerritoryDrawing(boundary, dataset);
  assert.ok(drawing.roads.some(road => road.name === 'Rua da Divisa' && road.kind === 'boundary'));
  const inner = drawing.roads.find(road => road.name === 'Rua Interna');
  assert.ok(inner);
  const minX = Math.min(...drawing.outline.map(p => p[0])), maxX = Math.max(...drawing.outline.map(p => p[0]));
  assert.ok(inner.points.every(p => p[0] >= minX - 0.01 && p[0] <= maxX + 0.01));
  assert.ok(!drawing.roads.some(road => road.name === 'Rua de Fora'));
  assert.deepEqual(drawing.landmarks.map(marker => marker.name), ['Escola dentro']);
  assert.equal(drawing.landmarks[0].kind, 'school');
});

test('all local territory contours produce valid cards containing streets without network calls', () => {
  for (const [number, territory] of Object.entries(territoryBoundaryProposals)) {
    const drawing = automaticTerritoryDrawing(territory.limites);
    assert.ok(drawing.roads.length > 0, `Missing streets in territory ${number}`);
    assert.deepEqual(validateEditableLayout(drawing), drawing);
  }
  const territory2 = automaticTerritoryDrawing(territoryBoundaryProposals[2].limites);
  assert.ok(territory2.roads.some(road => road.name.includes('Kléber')));
  assert.ok(territory2.landmarks.length > 0);
});

test('empty starter cards are filled automatically while existing manual drawings are preserved', () => {
  const starter = { version: 1, outline: [], roads: [], landmarks: [{ id: 'saved', name: 'Referência salva', kind: 'reference', position: [500,300] }] };
  const result = withTerritoryDrawing({ limites: territoryBoundaryProposals[2].limites, mapa_layout: starter });
  assert.ok(result.mapa_layout.roads.length > 0);
  assert.ok(result.mapa_layout.landmarks.some(marker => marker.id === 'saved'));
  assert.equal(starter.roads.length, 0);
  const manual = { roads: [{ id: 'manual', name: 'Rua corrigida' }] };
  assert.equal(withTerritoryDrawing({ limites: boundary, mapa_layout: manual }).mapa_layout, manual);
});

test('automatically generated cards follow a changed validated contour', () => {
  const first = automaticTerritoryDrawing(territoryBoundaryProposals[2].limites);
  const result = withTerritoryDrawing({ limites: territoryBoundaryProposals[3].limites, mapa_layout: first });
  assert.notEqual(result.mapa_layout.autoBoundaryFingerprint, first.autoBoundaryFingerprint);
  assert.notDeepEqual(result.mapa_layout.outline, first.outline);
});

test('nearby references share a numbered marker without losing their names or editing coordinates', () => {
  const points = [
    { id: 'osm-point-a', name: 'Escola', position: [400,300] },
    { id: 'osm-point-b', name: 'Loja', position: [405,305] },
    { id: 'osm-point-c', name: 'Praça', position: [600,400] },
    { id: 'manual', name: 'Referência manual', position: [200,200] },
  ];
  const original = structuredClone(points);
  const groups = automaticReferenceGroups(points);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.flatMap(group => group.markers.map(marker => marker.name)), ['Escola','Loja','Praça']);
  assert.deepEqual(points, original);
});

test('territory 2 represents the two Castelo Branco carriageways as a single avenue', () => {
  const drawing=automaticTerritoryDrawing(territoryBoundaryProposals[2].limites);
  assert.equal(drawing.roads.filter(road=>road.name==='Avenida Presidente Castelo Branco').length,1);
  assert.equal(drawing.roads.filter(road=>road.name==='Rua Coronel Kléber de Andrade').length,1);
});

test('parallel carriageways merge only when their names and nearby routes match', () => {
  const road=(id,name,lng)=>({id,name,points:[[lng,-9],[lng,-8.99]]});
  const source={roads:[
    road('a','Avenida Teste',-34.995),
    {...road('b','Avenida Teste',-34.99485),points:road('b','Avenida Teste',-34.99485).points.reverse()},
    road('c','Outra Rua',-34.9947),
    road('d','Avenida Teste',-34.992),
  ],landmarks:[]};
  const drawing=automaticTerritoryDrawing(boundary,source);
  assert.equal(drawing.roads.filter(item=>item.name==='Avenida Teste').length,2);
  assert.equal(drawing.roads.filter(item=>item.name==='Outra Rua').length,1);
});

test('previously saved automatic cards refresh their geometry while keeping the assigned group', () => {
  const territory={limites:territoryBoundaryProposals[2].limites,mapa_grupo_id:9};
  const old=automaticTerritoryDrawing(territory.limites);
  delete old.autoDrawingRevision;
  old.roads.push({...old.roads.find(road=>road.name==='Avenida Presidente Castelo Branco'),id:'old-duplicate'});
  const refreshed=withTerritoryDrawing({...territory,mapa_layout:old});
  assert.equal(refreshed.mapa_grupo_id,9);
  assert.equal(refreshed.mapa_layout.roads.filter(road=>road.name==='Avenida Presidente Castelo Branco').length,1);
  assert.equal(old.roads.filter(road=>road.name==='Avenida Presidente Castelo Branco').length,2);
});

test('territory 3 keeps a continuous western side despite the change of street name',()=>{
  const drawing=automaticTerritoryDrawing(territoryBoundaryProposals[3].limites);
  const boundaries=drawing.roads.filter(road=>road.kind==='boundary');
  assert.equal(boundaries.length,4);
  const western=boundaries.filter(road=>road.name.includes('Moscow')||road.name.includes('Mário de Oliveira'));
  assert.equal(western.length,1);
  assert.ok(western[0].name.includes('Moscow')&&western[0].name.includes('Mário de Oliveira'));
  assert.ok(western[0].points.length>=3);
  assert.ok(boundaries.some(road=>road.name==='Rua Químico Antônio Victor'));
  assert.ok(boundaries.some(road=>road.name==='Rua Maria Digna Gameiro'));
});

test('updating an older automatic territory 3 card preserves its group and selected references',()=>{
  const old=automaticTerritoryDrawing(territoryBoundaryProposals[3].limites);
  old.autoDrawingRevision=2;
  old.selectedReferenceIds=[];
  const updated=withTerritoryDrawing({limites:territoryBoundaryProposals[3].limites,mapa_layout:old,mapa_grupo_id:8});
  assert.equal(updated.mapa_grupo_id,8);
  assert.equal(updated.mapa_layout.roads.filter(road=>road.kind==='boundary').length,4);
  assert.deepEqual(updated.mapa_layout.landmarks,[]);
  assert.deepEqual(updated.mapa_layout.selectedReferenceIds,[]);
});
