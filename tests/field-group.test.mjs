import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { phoneContactLinks, validateGroupLeadership } = await loadModule('../../app/lib/field-group.js');
const { getOwnFieldGroup } = await loadModule('../../app/lib/field-group-server.js');

test('contact links normalize Brazilian numbers and reject missing or invalid contacts', () => {
  assert.deepEqual(phoneContactLinks('(21) 99999-9999'), { phone: 'tel:+5521999999999', whatsapp: 'https://wa.me/5521999999999' });
  assert.equal(phoneContactLinks('+55 21 99999-9999').phone, 'tel:+5521999999999');
  for (const value of ['', null, '123', 'not a phone 21999999999']) assert.equal(phoneContactLinks(value), null);
});
test('leadership selections reject malformed IDs and duplicate responsibilities', () => {
  assert.deepEqual(validateGroupLeadership({ grupo_id: 3, superintendente_id: '10', ajudante_id: '' }), { groupId: 3, superintendentId: 10, assistantId: null });
  for (const body of [{ grupo_id: -1 }, { grupo_id: 3, superintendente_id: true }, { grupo_id: 3, superintendente_id: 10, ajudante_id: 10 }]) assert.throws(() => validateGroupLeadership(body));
});
test('group read is bound to session membership and only discloses contact for the assigned leaders', async () => {
  const calls = [];
  const group = await getOwnFieldGroup({ query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT g.id')) return { rows: [{ id: 3, nome_grupo: 'Grupo de teste', ativo: true, super_id: 20, super_nome: 'Responsável', super_telefone: '(21) 99999-9999' }] };
    if (sql.includes('SELECT p.id')) return { rows: [{ id: 10, nome_completo: 'Publicador de teste', nome_chamado: 'Publicador', telefone: 'private', senha: 'private', email: 'private@example.test' }] };
    return { rows: [] };
  } }, 10);
  assert.equal(group.superintendent.name, 'Responsável');
  assert.equal(group.members[0].isSelf, true);
  assert.equal(group.members[0].phone, undefined); assert.ok(!JSON.stringify(group).includes('private'));
  const members = calls.find(call => call.sql.includes('SELECT p.id'));
  assert.deepEqual(members.params, [10, 3]); assert.match(members.sql, /me.id = \$1/);
  const leaderQuery = calls.find(call => call.sql.includes('SELECT g.id')).sql;
  assert.match(leaderQuery, /s.grupo_id = g.id/); assert.match(leaderQuery, /a.grupo_id = g.id/);
});
test('a publisher without a group gets a clear empty state without reading another group', async () => {
  const queries = [];
  const group = await getOwnFieldGroup({ query: async sql => { queries.push(sql); return { rows: [] }; } }, 10);
  assert.equal(group, null); assert.ok(!queries.some(sql => sql.includes('SELECT p.id')));
});

function routeFixture({ allowed = true, candidates = [], auditFails = false } = {}) {
  const calls = [];
  const route = loadRoute('../../app/api/admin/grupos/route.js', {
    authorizeRequest: async () => allowed ? null : { status: 403 },
    Pool: class { connect() { return { release() {}, query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: sql.startsWith('SELECT id FROM grupos') ? [{ id: 3 }] : sql.includes('SELECT id, grupo_id') ? candidates : [] };
    } }; } },
    ensureGroupLeadership: async () => {}, validateGroupLeadership, getUserIdFromRequest: () => 10,
    registerAuditLog: async () => { if (auditFails) throw new Error('Audit failed'); },
  });
  return { route, calls };
}
const request = body => ({ url: 'http://localhost/api/admin/grupos', json: async () => ({ action: 'leadership', grupo_id: 3, superintendente_id: 20, ...body }) });
test('only authorized staff can change leadership and group writes are atomically audited', async () => {
  const denied = routeFixture({ allowed: false });
  assert.equal((await denied.route.POST(request())).status, 403); assert.equal(denied.calls.length, 0);
  const valid = routeFixture({ candidates: [{ id: 20, grupo_id: 3, privilegios: ['anciao'] }] });
  assert.equal((await valid.route.POST(request())).status, 200);
  assert.equal(valid.calls[0].sql, 'BEGIN'); assert.equal(valid.calls.at(-1).sql, 'COMMIT');
  const update = valid.calls.find(call => call.sql.startsWith('UPDATE grupos'));
  assert.deepEqual(Array.from(update.params), [3, 20, null]);
  const failed = routeFixture({ candidates: [{ id: 20, grupo_id: 3, privilegios: ['anciao'] }], auditFails: true });
  assert.equal((await failed.route.POST(request())).status, 500); assert.equal(failed.calls.at(-1).sql, 'ROLLBACK');
});
test('leaders from another group or without the required role are rejected before updates', async () => {
  for (const candidate of [{ id: 20, grupo_id: 4, privilegios: ['anciao'] }, { id: 20, grupo_id: 3, privilegios: ['servo_ministerial'] }]) {
    const fixture = routeFixture({ candidates: [candidate] });
    assert.equal((await fixture.route.POST(request())).status, 400);
    assert.ok(!fixture.calls.some(call => call.sql.startsWith('UPDATE grupos')));
    assert.equal(fixture.calls.at(-1).sql, 'ROLLBACK');
  }
});
