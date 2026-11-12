import test from 'node:test';
import assert from 'node:assert/strict';
import { territoryMapDisplay, withTerritoryDrawing } from '../app/lib/territory-map-display.js';

const boundary = { type: 'Polygon', coordinates: [[[-35,-9],[-34.99,-9],[-34.99,-8.99],[-35,-8.99],[-35,-9]]] };

test('validated territories open their saved boundary without requiring the pilot editor', () => {
  for (const numero of [2, 3, 4, 5]) {
    const territory = { numero, limites: boundary, mapa_prototipo: false, mapa_layout: null };
    assert.equal(territoryMapDisplay(territory), 'editable');
    const card = withTerritoryDrawing(territory);
    assert.equal(card.mapa_layout.outline.length, 4);
    assert.equal(card.mapa_prototipo, true);
    assert.equal(territory.mapa_layout, null);
    assert.deepEqual(card.limites, boundary);
  }
});

test('editable cards take priority and territories without validated boundaries retain the original', () => {
  assert.equal(territoryMapDisplay({ mapa_prototipo: true, mapa_layout: {}, limites: {} }), 'editable');
  assert.equal(territoryMapDisplay({ mapa_prototipo: true, mapa_layout: null, limites: boundary }), 'editable');
  const saved = { mapa_layout: { roads: [{ name: 'Rua salva' }] }, limites: boundary };
  assert.equal(withTerritoryDrawing(saved).mapa_layout, saved.mapa_layout);
  assert.equal(territoryMapDisplay({ mapa_prototipo: false, mapa_layout: null, limites: null }), 'original');
  assert.equal(territoryMapDisplay(null), 'original');
});
