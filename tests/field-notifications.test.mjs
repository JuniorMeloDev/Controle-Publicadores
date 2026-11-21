import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldNotificationContent, sendFieldNotifications } from '../app/lib/field-notifications.js';

const outing = {
  data: '2026-11-21', horario: '08:30', modalidade: 'territorio', dirigente_unico: true,
  grupos: [1, 2], territorios: [6, 12, 26],
  territorios_por_grupo: { 1: [6, 12], 2: [26] }
};
const territories = new Map([
  [6, { id: 6, numero: 6, mapa_share_token: 'publico-6', mapa_disponivel: true }],
  [12, { id: 12, numero: 12, mapa_url: 'https://maps.example/12' }],
  [26, { id: 26, numero: 26, mapa_share_token: 'publico-26', mapa_disponivel: true }],
]);

test('each group receives only its territories and map links', () => {
  const sardio = fieldNotificationContent(outing, { id: 1, nome: 'Sárdio' }, territories);
  const rubi = fieldNotificationContent(outing, { id: 2, nome: 'Rubi' }, territories);
  assert.equal(sardio.title, 'Serviço de Campo · Sárdio');
  assert.equal(sardio.detail, 'Territórios 6, 12 · 08:30');
  assert.deepEqual(sardio.links.map(link => link.href), ['/mapa-territorio/publico-6', 'https://maps.example/12']);
  assert.equal(rubi.detail, 'Território 26 · 08:30');
  assert.deepEqual(rubi.links.map(link => link.href), ['/mapa-territorio/publico-26']);
  const common = fieldNotificationContent({ ...outing, grupos: [] }, null, territories);
  assert.equal(common.detail, 'Territórios 6, 12, 26 · 08:30');
});

test('an incomplete group distribution cannot broadcast the common list by accident', async () => {
  let writes = 0;
  const client = { query: async (sql, params) => {
    if (sql.includes('FROM campo_saidas')) return { rows: [{ ...outing, territorios_por_grupo: { 1: [6, 12] } }] };
    if (sql.includes('FROM publicadores p LEFT JOIN grupos')) {
      assert.deepEqual(params, [[1, 2]]);
      return { rows: [{ id: 10, grupo_id: 1 }, { id: 20, grupo_id: 2 }] };
    }
    if (sql.includes('FROM campo_territorios')) return { rows: [...territories.values()] };
    writes++;
    return { rows: [] };
  } };
  await assert.rejects(sendFieldNotifications(client, 60), /todos os grupos/);
  assert.equal(writes, 0);
});
