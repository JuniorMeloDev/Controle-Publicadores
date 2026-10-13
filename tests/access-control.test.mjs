import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const access = await loadModule('../../app/lib/access-control.js');
function loadService(file, exports, dependencies = {}) {
  const source = readFileSync(new URL('../app/lib/' + file, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const context = vm.createContext({ ...access, process: { env: {} }, URL, ...dependencies });
  vm.runInContext(source + '\nglobalThis.result = { ' + exports.join(',') + ' };', context);
  return context.result;
}
const { canAccessRoute } = loadService('route-access.js', ['canAccessRoute']);
const personal = { isSuperAdmin: false, permissions: access.normalizePermissions(null) };
const all = { isSuperAdmin: true, permissions: access.buildAllPermissions() };

test('S21 viewing and export require separate explicit grants regardless of page access', () => {
  for (const view of [false, true]) for (const exp of [false, true]) {
    const role = { isSuperAdmin: false, permissions: access.normalizePermissions({
      pages: { publicadores: true, relatorios: true }, actions: { s21_visualizar: view, s21_exportar: exp, relatorios_gerar: true }
    }) };
    assert.equal(canAccessRoute(role, '/api/admin/get-publicador/2'), true);
    assert.equal(canAccessRoute(role, '/api/admin/get-relatorios/2'), view);
    assert.equal(canAccessRoute(role, '/api/admin/relatorios/analise'), view);
    assert.equal(canAccessRoute(role, '/api/admin/relatorios-lote', 'POST'), view && exp);
    assert.equal(canAccessRoute(role, '/admin/relatorios/registro-publicador'), view && exp);
    assert.equal(canAccessRoute(role, '/admin/meu-s21'), true);
  }
});

test('S21 export authorization checks current grants on the server', async () => {
  let exports = false;
  const { authorizeRequest } = loadService('request-authorization.js', ['authorizeRequest'], {
    Pool: class { async connect() { return { release() {} }; } },
    getUserIdFromRequest: () => 7,
    getUserAccess: async () => ({ isSuperAdmin: false, permissions: access.normalizePermissions({ actions: { s21_visualizar: true, s21_exportar: exports } }) }),
    canAccessRoute, NextResponse: { json: (body, options) => ({ body, ...options }) },
  });
  const req = suffix => ({ url: 'https://example.com/api/admin/get-relatorios/8' + suffix, headers: { get: () => null } });
  assert.equal(await authorizeRequest(req(''), 'GET'), null);
  assert.equal((await authorizeRequest(req('?export=1'), 'GET')).status, 403);
  exports = true;
  assert.equal(await authorizeRequest(req('?export=1'), 'GET'), null);
  exports = false;
  assert.equal((await authorizeRequest(req('?export=1'), 'GET')).status, 403);
});

test('permissions deny missing keys, strings and unknown grants', () => {
  const perms = access.normalizePermissions({ pages: { publicadores: 'true' }, actions: { publicadores_editar: 'false', invented: true } });
  assert.equal(perms.pages.publicadores, false);
  assert.equal(perms.actions.publicadores_editar, false);
  assert.equal(perms.actions.configuracoes_editar, false);
  assert.equal(perms.actions.invented, undefined);
});

test('personal users access only personal pages and APIs, never administrative data', () => {
  for (const path of ['/admin/dashboard', '/admin/meus-dados', '/admin/minhas-designacoes', '/admin/meu-s21', '/admin/configuracoes/preferencias', '/api/admin/notificacoes', '/api/admin/alertas/preferencias']) assert.equal(canAccessRoute(personal, path), true, path);
  for (const path of ['/admin/gestao-acessos', '/admin/editar/2', '/admin/gerenciar', '/api/admin/get-publicador/2', '/api/admin/get-relatorios/2', '/api/admin/get-designacoes-publicador', '/api/admin/backup', '/api/admin/global-search', '/api/admin/unknown']) {
    assert.equal(canAccessRoute(personal, path, 'GET'), false, path);
    assert.equal(canAccessRoute(personal, path, 'POST'), false, path);
  }
});

test('delegated read access cannot write, delete, export backup or administer roles', () => {
  const delegated = { isSuperAdmin: false, permissions: access.normalizePermissions({ pages: { publicadores: true }, actions: { publicadores_editar: true } }) };
  assert.equal(canAccessRoute(delegated, '/api/admin/get-publicador/2'), true);
  assert.equal(canAccessRoute(delegated, '/api/admin/update-publicador/2', 'PUT'), true);
  assert.equal(canAccessRoute(delegated, '/api/admin/delete-publicador/2', 'DELETE'), false);
  assert.equal(canAccessRoute(delegated, '/api/admin/backup'), false);
  assert.equal(canAccessRoute(delegated, '/api/admin/gestao-acessos', 'POST'), false);
});

test('elder and ministerial privileges never bypass explicit permissions', async () => {
  const { getUserAccess } = loadService('server-access.js', ['getUserAccess']);
  for (const privileges of [['anciao'], ['servo_ministerial'], []]) {
    const client = { query: async sql => ({ rows: sql.includes('FROM publicadores p') ? [{ privilegios: privileges, super_admin: false, permissoes: null }] : [] }) };
    const result = await getUserAccess(client, 7);
    assert.equal(result.isSuperAdmin, false);
    assert.equal(result.permissions.pages.publicadores, undefined);
    assert.equal(canAccessRoute(result, '/api/admin/get-publicadores'), false);
  }
});

test('every admin handler has an in-handler guard and a route rule for super admins', () => {
  const root = new URL('../app/api/admin/', import.meta.url);
  for (const entry of readdirSync(root, { recursive: true }).filter(file => file.endsWith('route.js'))) {
    const source = readFileSync(new URL(entry.replaceAll('\\', '/'), root), 'utf8');
    const route = '/api/admin/' + entry.replaceAll('\\', '/').replace('/route.js', '').replace(/\[.*?\]/g, '123');
    for (const match of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)) {
      assert.ok(source.includes(`authorizeRequest(`), route);
      assert.equal(canAccessRoute(all, route, match[1]), true, `${match[1]} ${route}`);
    }
  }
});

test('handler denies access before reading or writing any publisher data', async () => {
  let connected = false;
  const { GET } = loadRoute('../../app/api/admin/get-publicador/[id]/route.js', {
    Pool: class { connect() { connected = true; throw new Error('Must not query'); } },
    authorizeRequest: async () => ({ status: 403 }),
  });
  assert.equal((await GET({}, { params: { id: 999 } })).status, 403);
  assert.equal(connected, false);
});

test('assignment directories disclose names and eligibility, without personal dates or email', async () => {
  const { GET } = loadRoute('../../app/api/admin/get-publicadores/route.js', {
    Pool: class { async connect() { return { query: async () => ({ rows: [{ id: 7, nome_completo: 'Fictício', sexo: 'Masculino', data_nascimento: '2000-01-01', email: 'private@example.com' }] }), release() {} }; } },
    getUserIdFromRequest: () => 8,
    getUserPermissions: async () => access.normalizePermissions({ pages: { designacoes: true } }),
  });
  const result = await GET({});
  assert.equal(result.body[0].nome_completo, 'Fictício');
  assert.equal(result.body[0].data_nascimento, undefined);
  assert.equal(result.body[0].email, undefined);
});

test('legacy personal-data and report endpoints reject anonymous requests before accessing data', async () => {
  for (const file of ['atualizacao-cadastral/buscar', 'atualizacao-cadastral/enviar', 'enviar-relatorio-mensal']) {
    let connects = 0;
    const { POST } = loadRoute(`../../app/api/${file}/route.js`, {
      getUserIdFromRequest: () => null,
      Pool: class { connect() { connects++; } },
    });
    assert.equal((await POST({})).status, 401);
    assert.equal(connects, 0);
  }
});

test('request guard checks database grants, request origin and protects account email changes', async () => {
  let userId = 7;
  let role = personal;
  let released = 0;
  const { authorizeRequest } = loadService('request-authorization.js', ['authorizeRequest'], {
    Pool: class { async connect() { return { query: async () => ({ rows: [{ email: 'original@example.com', super_admin: false }] }), release() { released++; } }; } },
    getUserIdFromRequest: () => userId, getUserAccess: async () => role, canAccessRoute,
    NextResponse: { json: (body, options) => ({ body, ...options }) },
  });
  const req = (path, body = {}, origin = 'https://example.com') => ({ url: 'https://example.com' + path,
    headers: { get: key => key === 'origin' ? origin : null }, clone: () => ({ json: async () => body }) });
  assert.equal((await authorizeRequest(req('/api/admin/get-publicadores'), 'GET')).status, 403);
  role = { isSuperAdmin: false, permissions: access.normalizePermissions({ pages: { publicadores: true }, actions: { publicadores_editar: true } }) };
  assert.equal(await authorizeRequest(req('/api/admin/get-publicadores'), 'GET'), null);
  assert.equal((await authorizeRequest(req('/api/admin/update-publicador/8', { email: 'attacker@example.com' }), 'PUT')).status, 403);
  assert.equal(await authorizeRequest(req('/api/admin/update-publicador/8', { email: 'original@example.com' }), 'PUT'), null);
  role = all;
  assert.equal((await authorizeRequest(req('/api/admin/update-publicador/8', { senha: 'InjectedPassword1!' }), 'PUT')).status, 400);
  assert.equal((await authorizeRequest(req('/api/admin/gestao-acessos', {}, 'https://attacker.example'), 'POST')).status, 403);
  userId = null;
  assert.equal((await authorizeRequest(req('/api/admin/get-publicadores'), 'GET')).status, 401);
  assert.ok(released >= 4);
});

test('personal data route ignores forged IDs and selects only the authenticated publisher', async () => {
  const ids = [];
  let released = false;
  const { GET } = loadRoute('../../app/api/minha-conta/route.js', {
    Pool: class { async connect() { return {
      query: async (sql, params) => {
        ids.push(params[0]);
        assert.ok(!sql.includes('p.senha'));
        if (sql.includes('COUNT')) return { rows: [{ total: 0 }] };
        if (sql.includes('FROM publicadores')) return { rows: [{ id: 7, nome_completo: 'Fictício' }] };
        return { rows: [] };
      }, release() { released = true; },
    }; } },
    CADASTRO_FIELDS: [['nome_completo']], getUserIdFromRequest: () => 7,
    getUserAccess: async () => personal, ensureCadastroTables: async () => {},
    getPublisherAssignments: async (_client, options) => { assert.equal(options.publisherId, 7); return []; },
  });
  const response = await GET({ url: 'https://example.com/api/minha-conta?id=999', json: async () => ({ publicadorId: 999 }) });
  assert.equal(response.status, 200);
  assert.equal(response.body.info.id, 7);
  assert.ok(ids.every(id => id === 7));
  assert.equal(released, true);
});

test('last super admin cannot be revoked and permission writes are transactionally audited', async () => {
  for (const count of [1, 2]) {
    const calls = [];
    const client = { query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('COALESCE')) return { rows: [{ id: 7, super_admin: true }] };
      if (sql.includes('COUNT')) return { rows: [{ total: count }] };
      return { rows: [] };
    } };
    const { updateAccess } = loadService('access-management.js', ['updateAccess'], {
      ensureAccessTable: async () => {}, getUserAccess: async () => all,
      registerAuditLog: async () => { calls.push({ sql: 'AUDIT' }); },
    });
    const result = await updateAccess(client, 7, { publicadorId: 7, permissoes: {}, superAdmin: false });
    assert.equal(result.status, count === 1 ? 409 : 200);
    assert.ok(calls.some(call => call.sql.includes('pg_advisory_xact_lock')));
    assert.equal(calls.at(-1).sql, count === 1 ? 'ROLLBACK' : 'COMMIT');
    assert.equal(calls.some(call => call.sql === 'AUDIT'), count > 1);
  }
});

test('bulk permission modes preserve unselected grants and super admin roles', async () => {
  for (const mode of ['add', 'remove', 'replace']) {
    let written;
    const client = { query: async (sql, params) => {
      if (sql.includes('COALESCE')) return { rows: [{ id: 8, super_admin: true, permissoes: { pages: { publicadores: true, reunioes: true } } }] };
      if (sql.includes('INSERT INTO acessos_app')) written = params;
      return { rows: [] };
    } };
    const { updateAccess } = loadService('access-management.js', ['updateAccess'], {
      ensureAccessTable: async () => {}, getUserAccess: async () => all, registerAuditLog: async () => {},
    });
    const result = await updateAccess(client, 7, { publicadorId: 8, mode, permissoes: { pages: { publicadores: true, relatorios: true } } });
    assert.equal(result.status, 200);
    const saved = JSON.parse(written[1]);
    assert.equal(saved.pages.publicadores, mode !== 'remove');
    assert.equal(saved.pages.reunioes, mode !== 'replace');
    assert.equal(saved.pages.relatorios, mode !== 'remove');
    assert.equal(written[2], true, 'bulk application does not change the super admin role');
  }
});

test('invalid modes and non-super-admin actors cannot change permissions', async () => {
  const calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: [] }; } };
  const { updateAccess } = loadService('access-management.js', ['updateAccess'], {
    ensureAccessTable: async () => {}, getUserAccess: async () => personal, registerAuditLog: async () => assert.fail('Unauthorized audit'),
  });
  assert.equal((await updateAccess(client, 7, { publicadorId: 8, mode: 'unknown', permissoes: {} })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await updateAccess(client, 7, { publicadorId: 8, mode: 'add', permissoes: {} })).status, 403);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.ok(!calls.some(sql => sql.includes('INSERT')));
});
