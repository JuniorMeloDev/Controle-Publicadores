import assert from 'node:assert/strict';
import test from 'node:test';
import { roadLabelLayout } from '../app/lib/road-label-layout.js';

const horizontal = { id: 'horizontal', name: 'R. Cel. Kléber de Andrade', points: [[0, 200], [600, 200]] };
const vertical = { id: 'vertical', name: 'Av. Bernardo Vieira de Melo', points: [[300, 0], [300, 400]] };
const measure = text => text.length * 9;
test('smaller street fonts reduce the label width while keeping it centered',()=>{
  const smaller={...horizontal,labelFontSize:12};
  const parts=roadLabelLayout(smaller,[smaller],measure);
  assert.equal(parts.length,1);
  assert.equal(parts[0].width,measure(horizontal.name)*12/18);
  assert.equal(parts[0].offset,300);
  assert.equal(parts[0].text,horizontal.name);
});

test('crossing street names split at word boundaries and leave the junction clear', () => {
  for (const road of [horizontal, vertical]) {
    const parts = roadLabelLayout(road, [horizontal, vertical], measure);
    assert.equal(parts.length, 2);
    assert.equal(parts.map(part => part.text).join(' '), road.name);
    const crossing = road === horizontal ? 300 : 200;
    assert.ok(parts[0].offset + parts[0].width / 2 <= crossing - 21);
    assert.ok(parts[1].offset - parts[1].width / 2 >= crossing + 21);
    assert.ok(Math.abs(parts[0].offset + parts[0].width / 2 - (crossing - 21)) < 0.001);
    assert.ok(Math.abs(parts[1].offset - parts[1].width / 2 - (crossing + 21)) < 0.001);
  }
});

test('streets without a crossing under their label keep a single centered name', () => {
  const endpoint = { ...vertical, points: [[600, 0], [600, 400]] };
  const distant = { ...vertical, points: [[30, 0], [30, 400]] };
  for (const roads of [[horizontal], [horizontal, endpoint], [horizontal, distant]]) {
    assert.deepEqual(roadLabelLayout(horizontal, roads, measure), [{ text: horizontal.name, offset: 300, width: measure(horizontal.name) }]);
  }
});

test('multiple crossings and polyline joints preserve every word without duplicate fragments', () => {
  const road = { ...horizontal, name: 'Rua Exemplo de Nome com Várias Palavras', points: [[0, 200], [300, 200], [600, 200]] };
  const crossings = [200, 300, 400].map((x, index) => ({ ...vertical, id: `v-${index}`, points: [[x, 0], [x, 400]] }));
  const parts = roadLabelLayout(road, [road, ...crossings], measure);
  assert.equal(parts.map(part => part.text).join(' '), road.name);
  for (const part of parts) {
    assert.ok(part.width > 0);
    for (const crossing of [200, 300, 400]) {
      assert.ok(part.offset + part.width / 2 <= crossing - 21 || part.offset - part.width / 2 >= crossing + 21);
    }
  }
});

test('diagonal crossings reserve a wider gap, and one-word names remain whole', () => {
  const diagonal = { ...vertical, points: [[100, 0], [500, 400]] };
  const parts = roadLabelLayout(horizontal, [horizontal, diagonal], measure);
  assert.ok(parts[0].offset + parts[0].width / 2 < 279);
  assert.ok(parts[1].offset - parts[1].width / 2 > 321);
  const oneWord = { ...horizontal, name: 'Independência' };
  assert.equal(roadLabelLayout(oneWord, [oneWord, vertical], measure)[0].text, oneWord.name);
});
