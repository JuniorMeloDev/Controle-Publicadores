import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-source.mjs';

const { buildTerritoryMessage, buildFieldOutingMessage, fieldWhatsAppUrl } = await loadModule('../../app/lib/field-service-share.js');
const { validateFieldRecord } = await loadModule('../../app/lib/field-service.js');
const territory = { id: 3, numero: 12, descricao: 'Bairro de teste', referencias: 'Quadra junto à escola', mapa_url: 'https://maps.app.goo.gl/teste' };
const data = { territorios: [territory, { id: 4, numero: 15 }], publicadores: [{ id: 1, nome: 'Dirigente de teste' }], grupos: [{ id: 2, nome: 'Grupo de teste' }], locais: [{ id: 5, nome: 'Salão do Reino', endereco: 'Rua de teste, 10', mapa_url: 'https://maps.google.com/?q=consideracao' }] };
const outing = { data: '2026-10-17', horario: '08:30', dirigente_publicador_id: 1, local_id: 5, grupos: [2], territorios: [3, 4], modalidade: 'territorio', observacoes: 'Levar o mapa atualizado' };

test('territory links and references validate and round-trip without requiring a PDF', () => {
  const record = validateFieldRecord('territorios', territory);
  assert.equal(record.mapa_url, territory.mapa_url);
  assert.equal(record.referencias, territory.referencias);
  for (const mapa_url of ['javascript:alert(1)', 'https://user:secret@example.com', 'invalid']) assert.throws(() => validateFieldRecord('territorios', { ...territory, mapa_url }));
  assert.equal(validateFieldRecord('territorios', { numero: 15 }).mapa_url, '');
});
test('outing sharing distinguishes the consideration location from the preaching territory', () => {
  const message = buildFieldOutingMessage(outing, data);
  for (const value of ['17/10/2026', '08:30', 'Dirigente de teste', 'Grupo de teste', 'Google Maps da consideração: https://maps.google.com/?q=consideracao', 'Google Maps do território: https://maps.app.goo.gl/teste', 'Território 12', 'Território 15', 'Quadra junto à escola', 'Levar o mapa atualizado']) assert.ok(message.includes(value));
  assert.equal(decodeURIComponent(fieldWhatsAppUrl(message).split('?text=')[1]), message);
  assert.ok(!message.includes('/api/admin/'));
});
test('sharing handles undecided outings, letters and missing links without including unsafe URLs', () => {
  const message = buildFieldOutingMessage({ ...outing, dirigente_publicador_id: null, local_id: null, grupos: [], modalidade: 'cartas' }, data);
  assert.ok(message.includes('Dirigente: A definir'));
  assert.ok(message.includes('Grupos: Congregação'));
  assert.ok(message.includes('Modalidade: Cartas'));
  assert.ok(!message.includes('Território 12'));
  assert.ok(!buildTerritoryMessage({ ...territory, mapa_url: 'javascript:alert(1)' }).includes('javascript:'));
});
