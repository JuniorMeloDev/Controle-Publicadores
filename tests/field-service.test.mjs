import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { fieldId, fieldDate, fieldServiceYear, weeklyDates, validateFieldRecord } = await loadModule('../../app/lib/field-service.js');
const { mutateFieldService, readFieldService } = await loadModule('../../app/lib/field-service-server.js');
const { canAccessRoute } = await loadModule('../../app/lib/route-access.js');
const { prepareFieldMap, saveFieldMap } = await loadModule('../../app/lib/field-map.js');
const outing = overrides => ({ data: '2026-10-17', horario: '08:30', modalidade: 'territorio', grupos: [1], territorios: [3], ...overrides });

test('field records reject invalid IDs, dates, map protocols and malformed lists', () => {
  for (const value of [true, -1, 0, '1.5', '2x', 2147483648]) assert.throws(() => fieldId(value));
  for (const date of ['2026-02-29', '2026-13-01', '2026-01-32', '17/10/2026', '1800-01-01']) assert.throws(() => fieldDate(date));
  assert.equal(fieldDate('2028-02-29'), '2028-02-29');
  for (const mapa_url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com', 'not a URL']) assert.throws(() => validateFieldRecord('locais', { nome: 'Local', mapa_url }));
  assert.equal(validateFieldRecord('locais', { nome: ' Local ', mapa_url: 'https://maps.google.com' }).nome, 'Local');
  assert.throws(() => validateFieldRecord('saidas', outing({ grupos: '1' })));
  assert.throws(() => validateFieldRecord('saidas', outing({ horario: '25:70' })));
  assert.throws(() => validateFieldRecord('saidas', outing({ modalidade: '__proto__' })));
  assert.deepEqual(validateFieldRecord('saidas', outing({ grupos: ['1', 1] })).grupos, [1]);
  assert.deepEqual(validateFieldRecord('saidas', outing({ modalidade: 'cartas' })).territorios, []);
});

test('weekly recurrence crosses calendar boundaries and service years change in September', () => {
  assert.deepEqual(weeklyDates('2026-12-26', 3), ['2026-12-26', '2027-01-02', '2027-01-09']);
  for (const count of [0, 13, 1.5, NaN]) assert.throws(() => weeklyDates('2026-10-17', count));
  assert.equal(fieldServiceYear('2026-08-31'), 2026);
  assert.equal(fieldServiceYear('2026-09-01'), 2027);
  assert.throws(() => validateFieldRecord('designacoes', { territorio_id: 1, publicador_id: 2, data_designacao: '2026-10-17', data_conclusao: '2026-10-16' }));
});

test('field-service authorization separates read access from explicit edit grants', () => {
  const access = { permissions: { pages: { designacoes: true }, actions: {} } };
  assert.equal(canAccessRoute(access, '/api/admin/servico-campo'), true);
  assert.equal(canAccessRoute(access, '/api/admin/servico-campo', 'POST'), false);
  access.permissions.actions.servico_campo_editar = true;
  assert.equal(canAccessRoute(access, '/api/admin/servico-campo', 'POST'), true);
  assert.equal(canAccessRoute({ permissions: {} }, '/api/admin/servico-campo'), false);
});

function serviceFixture({ conflict = false, inactive = false, existing = {}, overlap = false } = {}) {
  const calls = [];
  const client = { query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FOR SHARE')) return { rows: params[0].map(id => ({ id, ativo: !inactive })) };
    if (sql.includes('FOR UPDATE')) return { rows: Object.keys(existing).length ? [existing] : [] };
    if (sql.startsWith('SELECT id FROM campo_saidas')) return { rows: conflict ? [{ id: 99 }] : [] };
    if (sql.startsWith('SELECT id FROM campo_designacoes')) return { rows: overlap ? [{ id: 99 }] : [] };
    if (sql.startsWith('INSERT') || sql.startsWith('UPDATE') || sql.startsWith('DELETE')) return { rows: [{ id: calls.length }] };
    return { rows: [] };
  } };
  return { client, calls };
}

test('recurring outings are planned separately from territory handovers and conclusions', async () => {
  const fixture = serviceFixture();
  const result = await mutateFieldService(fixture.client, { entity: 'saidas', action: 'save', record: outing({ semanas: 3 }) });
  assert.equal(result.ids.length, 3);
  assert.ok(fixture.calls[0].sql.includes('pg_advisory_xact_lock'));
  assert.deepEqual(fixture.calls.filter(call => call.sql.startsWith('INSERT')).map(call => call.params[0]), ['2026-10-17', '2026-10-24', '2026-10-31']);
  assert.ok(!fixture.calls.some(call => /(?:INSERT INTO|UPDATE) campo_designacoes/.test(call.sql)));
});

test('any existing publisher can lead directly without a leader registration', async () => {
  const fixture = serviceFixture();
  await mutateFieldService(fixture.client, { entity: 'saidas', action: 'save', record: outing({ dirigente_publicador_id: 29 }) });
  const reference = fixture.calls.find(call => call.sql.startsWith('SELECT id FROM publicadores'));
  assert.deepEqual(reference.params, [[29]]);
  assert.ok(!fixture.calls.some(call => call.sql.includes('campo_dirigentes')));
  const insert = fixture.calls.find(call => call.sql.startsWith('INSERT'));
  assert.ok(insert.sql.includes('dirigente_publicador_id'));
  assert.equal(validateFieldRecord('saidas', outing({ dirigente_publicador_id: '' })).dirigente_publicador_id, null);
  assert.equal(validateFieldRecord('saidas', outing({ dirigente_id: 10 })).dirigente_id, null);
  await assert.rejects(mutateFieldService(fixture.client, { entity: 'dirigentes', action: 'save', record: { publicador_id: 29 } }), /Cadastro inválido/);
});

test('conflicts, inactive selections and overlapping handovers fail before insertion', async () => {
  for (const settings of [{ conflict: true }, { inactive: true }]) {
    const fixture = serviceFixture(settings);
    await assert.rejects(mutateFieldService(fixture.client, { entity: 'saidas', action: 'save', record: outing() }));
    assert.ok(!fixture.calls.some(call => call.sql.startsWith('INSERT')));
  }
  const fixture = serviceFixture({ overlap: true });
  await assert.rejects(mutateFieldService(fixture.client, { entity: 'designacoes', action: 'save', record: { territorio_id: 3, publicador_id: 2, data_designacao: '2026-10-17' } }), /já está designado/);
  assert.ok(!fixture.calls.some(call => call.sql.startsWith('INSERT')));
});

test('conclusion validates the handover date and refuses repeated completions', async () => {
  for (const [existing, date] of [[{ id: 1, data_designacao: '2026-10-17' }, '2026-10-16'], [{ id: 1, data_designacao: '2026-10-17', data_conclusao: '2026-10-18' }, '2026-10-19']]) {
    const fixture = serviceFixture({ existing });
    await assert.rejects(mutateFieldService(fixture.client, { entity: 'designacoes', action: 'complete', id: 1, data_conclusao: date }));
    assert.ok(!fixture.calls.some(call => call.sql.startsWith('UPDATE')));
  }
  const fixture = serviceFixture({ existing: { id: 1, data_designacao: '2026-10-17' } });
  await mutateFieldService(fixture.client, { entity: 'designacoes', action: 'complete', id: 1, data_conclusao: '2026-10-18' });
  assert.deepEqual(fixture.calls.find(call => call.sql.startsWith('UPDATE')).params, [1, '2026-10-18']);
});

function routeFixture({ allowed = true, auditFails = false, failSecond = false } = {}) {
  const fixture = serviceFixture();
  let inserted = 0;
  const query = fixture.client.query;
  fixture.client.release = () => {};
  fixture.client.query = async (sql, params) => {
    if (sql.startsWith('INSERT') && failSecond && ++inserted === 2) throw Object.assign(new Error('Duplicate'), { code: '23505' });
    return query(sql, params);
  };
  const route = loadRoute('../../app/api/admin/servico-campo/route.js', {
    Pool: class { async connect() { return fixture.client; } }, authorizeRequest: async () => allowed ? null : { status: 403 },
    readFieldService, mutateFieldService, prepareFieldMap, saveFieldMap, getUserIdFromRequest: () => 2,
    registerAuditLog: async () => { fixture.calls.push({ sql: 'AUDIT' }); if (auditFails) throw new Error('Audit failed'); }
  });
  return { ...fixture, route };
}
const request = record => ({ json: async () => ({ action: 'save', entity: 'saidas', record }) });

test('API denies before reading the database and commits only after atomic audit', async () => {
  const denied = routeFixture({ allowed: false });
  assert.equal((await denied.route.POST(request(outing()))).status, 403);
  assert.equal((await denied.route.GET({})).status, 403);
  assert.equal(denied.calls.length, 0);
  const valid = routeFixture();
  assert.equal((await valid.route.POST(request(outing()))).status, 200);
  assert.equal(valid.calls[0].sql, 'BEGIN');
  assert.equal(valid.calls.at(-2).sql, 'AUDIT');
  assert.equal(valid.calls.at(-1).sql, 'COMMIT');
  const failed = routeFixture({ auditFails: true });
  assert.equal((await failed.route.POST(request(outing()))).status, 500);
  assert.equal(failed.calls.at(-1).sql, 'ROLLBACK');
});

test('a failed recurring batch rolls back all outings; invalid payloads do not commit', async () => {
  const failed = routeFixture({ failSecond: true });
  assert.equal((await failed.route.POST(request(outing({ semanas: 3 })))).status, 409);
  assert.equal(failed.calls.at(-1).sql, 'ROLLBACK');
  const invalid = routeFixture();
  assert.equal((await invalid.route.POST(request(outing({ data: '2026-02-29' })))).status, 400);
  assert.equal(invalid.calls.at(-1).sql, 'ROLLBACK');
  assert.ok(!invalid.calls.some(call => call.sql.startsWith('INSERT')));
});

test('deleting a planned outing preserves handover history and master records cannot be deleted', async () => {
  const fixture = serviceFixture();
  await mutateFieldService(fixture.client, { action: 'delete', entity: 'saidas', id: 1 });
  assert.ok(!fixture.calls.some(call => call.sql.includes('campo_designacoes')));
  await assert.rejects(mutateFieldService(fixture.client, { action: 'delete', entity: 'territorios', id: 1 }), /Desative/);
});

test('territory and uploaded PDF save together and an audit failure rolls back both', async () => {
  const bytes = Buffer.from('%PDF-1.4\n%%EOF');
  const request = { headers: { get: () => 'multipart/form-data' }, formData: async () => new Map([
    ['dados', JSON.stringify({ action: 'save', entity: 'territorios', record: { numero: 7 } })],
    ['arquivo', { name: 'mapa.pdf', size: bytes.length, arrayBuffer: async () => bytes }]
  ]) };
  for (const auditFails of [false, true]) {
    const fixture = routeFixture({ auditFails });
    assert.equal((await fixture.route.POST(request)).status, auditFails ? 500 : 200);
    assert.ok(fixture.calls.some(call => call.sql.startsWith('INSERT INTO campo_territorios')));
    assert.ok(fixture.calls.some(call => call.sql.startsWith('INSERT INTO campo_mapas')));
    assert.equal(fixture.calls.at(-1).sql, auditFails ? 'ROLLBACK' : 'COMMIT');
  }
});
