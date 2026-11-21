import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/load-source.mjs';

const { buildTerritoryMessage, buildFieldOutingMessage, fieldWhatsAppUrl } = await loadModule('../../app/lib/field-service-share.js');
const { validateFieldRecord } = await loadModule('../../app/lib/field-service.js');
const territory = { id: 3, numero: 12, descricao: 'Bairro de teste', referencias: 'Quadra junto à escola', mapa_url: 'https://maps.app.goo.gl/teste' };
const data = { territorios: [territory, { id: 4, numero: 15 }], publicadores: [{ id: 1, nome: 'Dirigente de teste' }], grupos: [{ id: 2, nome: 'Grupo de teste' }], locais: [{ id: 5, nome: 'Salão do Reino', endereco: 'Rua de teste, 10', mapa_url: 'https://maps.google.com/?q=consideracao' }] };
const outing = { data: '2026-10-17', horario: '08:30', dirigente_publicador_id: 1, local_id: 5, grupos: [2], territorios: [3, 4], modalidade: 'territorio', observacoes: 'Levar o mapa atualizado' };

test('shared outing messages distinguish each group territory and groups awaiting assignment', () => {
  const sharedData = { ...data, grupos: [{ id: 2, nome: 'Opala' }, { id: 7, nome: 'Rubi' }, { id: 8, nome: 'Turqueza' }] };
  const message = buildFieldOutingMessage({ ...outing, dirigente_unico: true, grupos: [2, 7, 8], territorios_por_grupo: { 2: [3], 7: [4] } }, sharedData);
  assert.ok(message.includes('*Opala*\n🧭 *TERRITÓRIO 12*'));
  assert.ok(message.includes('*Rubi*\n🧭 *TERRITÓRIO 15*'));
  assert.ok(message.includes('*Turqueza*\nTerritórios a definir'));
  assert.equal(message.split('*TERRITÓRIO 12*').length, 2);
  assert.equal((message.match(/\*Dirigente:\*/g) || []).length, 1);
});

test('outing sharing includes inherited work that the next responsible person must continue', () => {
  const message = buildFieldOutingMessage(outing, { ...data, designacoes: [
    { id: 10, territorio_id: 3, publicador_id: 1, data_conclusao: null, data_transferencia: null, orientacoes_continuacao: 'Faltam as quadras 3 e 4.' },
  ] });
  assert.ok(message.includes('CONTINUAÇÃO — O QUE FALTA TRABALHAR'));
  assert.ok(message.includes('Faltam as quadras 3 e 4.'));
});

test('territory links and references validate and round-trip without requiring a PDF', () => {
  const record = validateFieldRecord('territorios', territory);
  assert.equal(record.mapa_url, territory.mapa_url);
  assert.equal(record.referencias, territory.referencias);
  for (const mapa_url of ['javascript:alert(1)', 'https://user:secret@example.com', 'invalid']) assert.throws(() => validateFieldRecord('territorios', { ...territory, mapa_url }));
  assert.equal(validateFieldRecord('territorios', { numero: 15 }).mapa_url, '');
});
test('outing sharing distinguishes the consideration location from the preaching territory', () => {
  const message = buildFieldOutingMessage(outing, data);
  for (const value of ['🌿 *SERVIÇO DE CAMPO*', '📅 *Data:* 17/10/2026', '🕒 *Horário:* 08:30', '*Dirigente:* Dirigente de teste', '*Grupos:* Grupo de teste', '*LOCAL DA CONSIDERAÇÃO*', '*Salão do Reino*', '*ENDEREÇO DO TERRITÓRIO (GOOGLE MAPS):*\nhttps://maps.app.goo.gl/teste', '*TERRITÓRIO 12*', '*TERRITÓRIO 15*', 'Quadra junto à escola', 'ORIENTAÇÕES DA SAÍDA', 'Levar o mapa atualizado']) assert.ok(message.includes(value));
  assert.ok(message.includes('Rua de teste, 10'));
  assert.ok(message.includes('maps.google.com/?q=consideracao'));
  assert.ok(message.startsWith('🌿 *SERVIÇO DE CAMPO*'));
  assert.equal(decodeURIComponent(fieldWhatsAppUrl(message).split('?text=')[1]), message);
  assert.ok(!message.includes('/api/admin/'));
});
test('a public interactive map link appears only with its territory', () => {
  const previewUrl = 'https://example.test/mapa-territorio/opaque-token';
  const message = buildFieldOutingMessage(outing, data, { 3: previewUrl });
  assert.ok(message.startsWith('🌿 *SERVIÇO DE CAMPO*'));
  assert.equal(message.split(previewUrl).length, 2);
  assert.ok(message.includes(`*MAPA DO TERRITÓRIO:*\n${previewUrl}`));
  assert.ok(message.includes('ENDEREÇO DO TERRITÓRIO (GOOGLE MAPS)'));
});
test('sharing handles undecided outings, letters and missing links without including unsafe URLs', () => {
  const message = buildFieldOutingMessage({ ...outing, dirigente_publicador_id: null, local_id: null, grupos: [], modalidade: 'cartas' }, data);
  assert.ok(message.includes('*Dirigente:* A definir'));
  assert.ok(message.includes('*Grupos:* Congregação'));
  assert.ok(message.includes('*Modalidade:* Cartas'));
  assert.ok(!message.includes('Território 12'));
  assert.ok(!message.startsWith('https://'));
  assert.ok(!buildTerritoryMessage({ ...territory, mapa_url: 'javascript:alert(1)' }).includes('javascript:'));
});
