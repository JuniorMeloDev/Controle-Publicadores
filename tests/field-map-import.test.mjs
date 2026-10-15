import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers/load-source.mjs';
const { territoryNumberFromFilename, fieldImportError } = await loadModule('../../app/lib/field-map-import.js');
test('numeric PDF names identify territories without guessing unrelated numbers', () => {
  for (const [name, expected] of [['1.pdf', '1'], ['030.PDF', '30'], ['0.pdf', ''], ['mapa-2.pdf', ''], ['2147483648.pdf', ''], ['2.png', '']]) {
    assert.equal(territoryNumberFromFilename(name), expected);
  }
});
test('batch review rejects duplicates, existing territories and invalid PDFs', () => {
  const item = { numero: '1', file: { name: '1.pdf', size: 100 } };
  assert.equal(fieldImportError(item, [item], []), '');
  assert.match(fieldImportError(item, [item, { ...item, numero: '01' }], []), /repetido/);
  assert.match(fieldImportError(item, [item], [{ numero: 1, ativo: false }]), /já cadastrado/);
  assert.match(fieldImportError({ ...item, numero: '' }, [], []), /válido/);
  assert.match(fieldImportError({ ...item, file: { name: '1.pdf', size: 11 * 1024 * 1024 } }, [], []), /10 MB/);
});
