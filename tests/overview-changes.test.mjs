import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const changesModule = await loadModule('../../app/lib/overview-changes.js');
const { overviewSnapshot, detectOverviewChanges, mergeOverviewChanges } = changesModule;
const today = '2030-01-07';
const timestamp = '2030-01-07T12:00:00Z';
const meeting = { id: 1, data: '2030-01-09', tipo: 'Meio de Semana', cancelado: false };
const assignment = { id: 'vida-1', data_reuniao: '2030-01-09', nome_parte: 'Leitura da Bíblia', descricao_semana: 'Semana 1', categoria: 'Vida e Ministério', publicador_id: 10, email: 'private@example.com' };
const baseline = overviewSnapshot([meeting], [assignment]);

test('first visit and unchanged visits produce no recent-change alerts', () => {
  assert.deepEqual(detectOverviewChanges(null, baseline, today), []);
  assert.deepEqual(detectOverviewChanges(baseline, baseline, today), []);
  assert.ok(!JSON.stringify(baseline).includes('private'));
});
test('date transfers, cancellation and reactivation describe the affected meeting', () => {
  const moved = overviewSnapshot([{ ...meeting, data: '2030-01-08' }], [assignment]);
  const transfer = detectOverviewChanges(baseline, moved, today, timestamp);
  assert.equal(transfer.length, 1); assert.match(transfer[0].description, /09\/01\/2030 para 08\/01\/2030/);
  const cancelled = overviewSnapshot([{ ...meeting, cancelado: true, motivo_cancelamento: 'Assembleia' }], [assignment]);
  assert.equal(detectOverviewChanges(baseline, cancelled, today, timestamp)[0].title, 'Reunião cancelada');
  assert.equal(detectOverviewChanges(cancelled, baseline, today, timestamp)[0].title, 'Reunião reativada');
});
test('personal assignment changes and removals link to the personal assignments page', () => {
  const changed = overviewSnapshot([meeting], [{ ...assignment, nome_parte: 'Demonstração', descricao_semana: 'Novas orientações' }]);
  const notice = detectOverviewChanges(baseline, changed, today, timestamp)[0];
  assert.equal(notice.href, '/admin/minhas-designacoes'); assert.match(notice.description, /Antes: Leitura da Bíblia/);
  const removed = detectOverviewChanges(baseline, overviewSnapshot([meeting], []), today, timestamp);
  assert.equal(removed[0].title, 'Sua designação foi removida');
});
test('passing dates and newly scheduled items do not create misleading change alerts', () => {
  assert.deepEqual(detectOverviewChanges(baseline, overviewSnapshot([], []), '2030-01-10', timestamp), []);
  const newItems = overviewSnapshot([meeting, { ...meeting, id: 2 }], [assignment, { ...assignment, id: 'vida-2' }]);
  assert.deepEqual(detectOverviewChanges(baseline, newItems, today, timestamp), []);
});
test('reimported responsibilities retain logical identity instead of becoming removals', () => {
  const reimported = overviewSnapshot([meeting], [{ ...assignment, id: 'vida-999' }]);
  assert.deepEqual(detectOverviewChanges(baseline, reimported, today, timestamp), []);
  const linkedBefore = overviewSnapshot([meeting], [{ ...assignment, reuniao_id: 1 }]);
  const moved = overviewSnapshot([meeting], [{ ...assignment, id: 'vida-999', reuniao_id: 1, data_reuniao: '2030-01-08' }]);
  assert.equal(detectOverviewChanges(linkedBefore, moved, today, timestamp)[0].title, 'Sua designação foi alterada');
});
test('seen alerts do not reappear, and stale or past-date alerts expire', () => {
  const next = overviewSnapshot([meeting], [{ ...assignment, descricao_semana: 'Alterada' }]);
  const alerts = detectOverviewChanges(baseline, next, today, timestamp);
  assert.equal(mergeOverviewChanges(alerts, detectOverviewChanges(next, next, today, timestamp), today).length, 1);
  assert.deepEqual(mergeOverviewChanges([], detectOverviewChanges(next, next, today, timestamp), today), []);
  assert.deepEqual(mergeOverviewChanges(alerts, [], '2030-01-10'), []);
  assert.deepEqual(mergeOverviewChanges([{ ...alerts[0], date: '2030-02-01', detectedAt: '2029-12-01T12:00:00Z' }], [], today), []);
});

const serverSource = readFileSync(new URL('../app/lib/overview-changes-server.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const context = vm.createContext({ ...changesModule });
vm.runInContext(serverSource + '\nglobalThis.server = { recordOverviewChanges };', context);
test('snapshot and alerts update atomically using only the session publisher ID', async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT snapshot')) return { rows: [{ snapshot: baseline, mudancas: [] }] };
    return { rows: [] };
  } };
  const alerts = await context.server.recordOverviewChanges(client, 10, [{ ...meeting, data: '2030-01-08' }], [assignment], today, timestamp);
  assert.equal(alerts.length, 1);
  assert.ok(calls.some(call => call.sql.includes('FOR UPDATE')));
  for (const call of calls.filter(call => call.params)) assert.equal(call.params[0], 10);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});
test('failed snapshot persistence rolls back', async () => {
  const calls = [];
  await assert.rejects(context.server.recordOverviewChanges({ query: async sql => {
    calls.push(sql);
    if (sql.startsWith('SELECT snapshot')) return { rows: [{ snapshot: baseline, mudancas: [] }] };
    if (sql.startsWith('UPDATE')) throw new Error('DB write failed');
    return { rows: [] };
  } }, 10, [meeting], [assignment], today), /DB write failed/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});
test('marking changes as seen rejects foreign origin and binds updates to the current account', async () => {
  let userId = 10;
  const calls = [];
  const route = loadRoute('../../app/api/visao-geral/route.js', {
    Pool: class { connect() { return { release() {}, query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } }; } },
    getUserIdFromRequest: () => userId, getUserAccess: async () => ({}), ensureOverviewState: async () => {},
  });
  const request = { url: 'http://localhost/api/visao-geral', headers: { get: () => null }, json: async () => ({ ids: ['assignments:vida-1:2030'], publicador_id: 999 }) };
  assert.equal((await route.POST(request)).status, 200); assert.equal(calls[0].params[0], 10);
  assert.match(calls[0].sql, /WHERE publicador_id = \$1/);
  assert.equal((await route.POST({ ...request, headers: { get: () => 'https://foreign.example' } })).status, 403);
  userId = null; assert.equal((await route.POST(request)).status, 401);
});
