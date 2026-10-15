import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { updateDraftAssignments, updateDraftSchedule } = await loadModule('../../app/lib/life-ministry-draft.js');

test('choosing people, automatic filling and editing titles leave saved assignments unchanged', () => {
  const saved = Object.freeze({ presidente: 'Original', comentarios_iniciais: 'Original', tesouro_0: 'Leitor original' });
  const chosen = updateDraftAssignments(saved, 'presidente', 'Novo presidente');
  assert.equal(chosen.comentarios_iniciais, 'Novo presidente');
  assert.equal(saved.presidente, 'Original');
  const automatic = updateDraftAssignments(saved, { presidente: 'Automático', tesouro_0: 'Novo leitor' });
  assert.equal(automatic.cantico_meio, 'Automático');
  assert.equal(saved.tesouro_0, 'Leitor original');
  const cleared = updateDraftAssignments(chosen, 'presidente', '');
  assert.equal(cleared.comentarios_finais, '');
  const schedule = Object.freeze({ treasures: Object.freeze([Object.freeze({ title: 'Título original' })]) });
  const draft = updateDraftSchedule(schedule, 'treasures', 0, 'Outro título');
  assert.equal(draft.treasures[0].title, 'Outro título');
  assert.equal(schedule.treasures[0].title, 'Título original');
});

test('only a successful save applies the draft to the list and allows closing the modal', async () => {
  const source = readFileSync(new URL('../app/components/designacoes/LifeMinistryTab.jsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('  const handleSaveCurrent ='), source.indexOf('  const handleGeneratePDF ='));
  const original = { tesouro_0: 'Original' };
  let committed = [original], storedSchedule = [{ treasures: [] }], fail = true, sent;
  const context = vm.createContext({
    schedules: storedSchedule, assignmentsList: committed, currentIndex: 0,
    weekDescriptions: ['Semana'], meetingDates: ['2030-01-09'], meetingIds: [7],
    setIsSaving() {}, setToastData() {}, refreshSavedMeetings() {},
    setSchedules: update => { storedSchedule = update(storedSchedule); },
    setAssignmentsList: update => { committed = update(committed); },
    fetch: async (_url, options) => { sent = JSON.parse(options.body); return { ok: !fail, json: async () => ({ message: 'Falha simulada' }) }; },
  });
  vm.runInContext(handler + '\nglobalThis.save = handleSaveCurrent;', context);
  const draft = { schedule: { treasures: [{ title: 'Parte' }] }, assignments: { tesouro_0: 'Novo' } };
  assert.equal(await context.save(draft), false);
  assert.equal(committed[0], original);
  assert.equal(sent.assignments.tesouro_0, 'Novo');
  fail = false;
  assert.equal(await context.save(draft), true);
  assert.equal(committed[0].tesouro_0, 'Novo');
  assert.equal(storedSchedule[0].treasures[0].title, 'Parte');
});

function deletionRoute({ allowed = true, auditFails = false, denied } = {}) {
  const queries = [];
  const route = loadRoute('../../app/api/admin/salvar-designacoes/route.js', {
    Pool: class { connect() { return { query: async (sql, values) => { queries.push({ sql, values }); return { rows: [] }; }, release() {} }; } },
    authorizeRequest: async () => denied || null,
    getUserIdFromRequest: () => 7, getUserPermissions: async () => ({}), isAllowed: () => allowed,
    registerAuditLog: async () => { if (auditFails) throw new Error('Audit unavailable'); },
  });
  return { ...route, queries };
}
const request = date => ({ url: `https://example.test/api/admin/salvar-designacoes?date=${date}` });

test('deleting a week removes registered and external participants while preserving programme and calendar', async () => {
  const route = deletionRoute();
  assert.equal((await route.DELETE(request('2030-01-09'))).status, 200);
  assert.equal(route.queries[0].sql, 'BEGIN');
  assert.equal(route.queries.at(-1).sql, 'COMMIT');
  const removed = route.queries.find(q => q.sql.startsWith('DELETE'));
  assert.match(removed.sql, /DELETE FROM designacoes_reuniao WHERE data_reuniao=\$1/);
  assert.deepEqual(Array.from(removed.values), ['2030-01-09']);
  assert.ok(route.queries.some(q => q.sql.includes('participantes_externos')));
  assert.ok(!route.queries.some(q => /DELETE FROM (reunioes_dados|reunioes_registro)/.test(q.sql)));
});

test('deletion rejects unauthorized users and invalid dates, and rolls back when audit fails', async () => {
  const denied = deletionRoute({ denied: { status: 401 } });
  assert.equal((await denied.DELETE(request('2030-01-09'))).status, 401);
  assert.equal(denied.queries.length, 0);
  const forbidden = deletionRoute({ allowed: false });
  assert.equal((await forbidden.DELETE(request('2030-01-09'))).status, 403);
  assert.equal(forbidden.queries.length, 0);
  for (const date of ['2030-02-31', 'invalid', '2030-01-09;DELETE']) {
    assert.equal((await deletionRoute().DELETE(request(date))).status, 400);
  }
  const failed = deletionRoute({ auditFails: true });
  assert.equal((await failed.DELETE(request('2030-01-09'))).status, 500);
  assert.equal(failed.queries.at(-1).sql, 'ROLLBACK');
  assert.ok(!failed.queries.some(q => q.sql === 'COMMIT'));
});
