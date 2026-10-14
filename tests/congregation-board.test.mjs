import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { isCalendarDate } = await loadModule('../../app/lib/meeting-calendar.js');
const source = readFileSync(new URL('../app/lib/congregation-board.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const context = vm.createContext({ isCalendarDate, URL });
vm.runInContext(source + '\nglobalThis.board = { canManageBoard, validateBoardPost };', context);
const { canManageBoard, validateBoardPost } = context.board;
const valid = { tipo: 'anuncio', titulo: 'Aviso de teste', mensagem: 'Mensagem de teste', inicio: '2030-01-07' };

test('only elders and super admins can manage the board, independent of dashboard permissions', () => {
  assert.equal(canManageBoard({ user: { privilegios: ['anciao'] } }), true);
  assert.equal(canManageBoard({ isSuperAdmin: true }), true);
  assert.equal(canManageBoard({ permissions: { pages: { dashboard: true } }, user: { privilegios: ['servo_ministerial'] } }), false);
  assert.equal(canManageBoard({ user: { privilegios: 'anciao' } }), false);
  assert.equal(canManageBoard(null), false);
});

test('rejects invalid publication periods, unsafe links and incomplete outings', () => {
  for (const change of [{ inicio: '2030-02-30' }, { fim: '2030-01-01' }, { grupo_id: -1 }, { titulo: ' ' }, { link: 'javascript:alert(1)' }, { link: 'https://user:pass@example.com' }, { tipo: 'saida' }]) {
    assert.throws(() => validateBoardPost({ ...valid, ...change }));
  }
  const outing = { ...valid, tipo: 'saida', data: '2030-01-08', horario: '09:30', local: 'Local de teste' };
  assert.equal(validateBoardPost(outing).horario, '09:30');
  for (const change of [{ horario: '25:00' }, { data: '2030-01-06' }, { fim: '2030-01-07' }]) assert.throws(() => validateBoardPost({ ...outing, ...change }));
  const post = validateBoardPost({ ...valid, autor_id: 999, id: 999, link: 'https://example.com', fixado: 'true' });
  assert.equal(post.autor_id, undefined);
  assert.equal(post.fixado, false);
});

test('materials require a safe link and preserve audience and publication period', () => {
  assert.throws(() => validateBoardPost({ ...valid, tipo: 'material' }), /link do material/);
  assert.throws(() => validateBoardPost({ ...valid, tipo: 'material', link: 'file:///private.pdf' }));
  const material = validateBoardPost({ ...valid, tipo: 'material', link: 'https://example.com/material.pdf', grupo_id: 3, fim: '2030-02-01', confirmar_leitura: true });
  assert.equal(material.tipo, 'material'); assert.equal(material.grupo_id, 3);
  assert.equal(material.fim, '2030-02-01'); assert.equal(material.confirmar_leitura, false);
});

function fixture() {
  let userId = 10;
  let access = { user: { privilegios: [] } };
  let posts = [{ id: 1, tipo: 'anuncio' }];
  const calls = [];
  const client = { release() {}, query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT id FROM grupos')) return { rows: [{ id: 3 }] };
    if (/RETURNING id/.test(sql)) return { rows: [{ id: 1 }] };
    return { rows: [] };
  } };
  const route = loadRoute('../../app/api/mural/route.js', {
    Pool: class { connect() { return client; } },
    getUserIdFromRequest: () => userId, getUserAccess: async () => access,
    canManageBoard, validateBoardPost, ensureBoardTables: async () => {},
    getVisiblePosts: async () => posts, registerAuditLog: async (_client, input) => calls.push({ audit: input }),
  });
  return { route, calls, user: value => { userId = value; }, access: value => { access = value; }, posts: value => { posts = value; } };
}
const request = body => ({ url: 'http://localhost/api/mural', headers: { get: () => null }, json: async () => body });

test('denies anonymous, missing accounts and publisher writes before changing data', async () => {
  const f = fixture();
  assert.equal((await f.route.POST(request({ ...valid, action: 'save' }))).status, 403);
  assert.equal((await f.route.GET({ url: 'http://localhost/api/mural?manage=1' })).status, 403);
  f.user(null);
  assert.equal((await f.route.GET(request({}))).status, 401);
  f.user(10); f.access(null);
  assert.equal((await f.route.POST(request({ action: 'read', id: 1 }))).status, 401);
  assert.equal(f.calls.length, 0);
});

test('read confirmations use session identity and cannot target invisible announcements or outings', async () => {
  const f = fixture();
  assert.equal((await f.route.POST(request({ action: 'read', id: 99, publicador_id: 999 }))).status, 404);
  assert.equal((await f.route.POST(request({ action: 'read', id: 1, publicador_id: 999 }))).status, 200);
  assert.deepEqual(Array.from(f.calls[0].params), [1, 10]);
  f.posts([{ id: 2, tipo: 'saida' }]);
  assert.equal((await f.route.POST(request({ action: 'read', id: 2 }))).status, 404);
});

test('cross-origin writes fail before database access', async () => {
  const f = fixture(); f.access({ isSuperAdmin: true });
  const req = request({ ...valid, action: 'save' }); req.headers.get = () => 'https://foreign.example';
  assert.equal((await f.route.POST(req)).status, 403);
  assert.equal(f.calls.length, 0);
});

test('elder edits clear reading confirmations and audit the write inside a transaction', async () => {
  const f = fixture(); f.access({ user: { privilegios: ['anciao'] } });
  const result = await f.route.POST(request({ ...valid, action: 'save', id: 1, autor_id: 999 }));
  assert.equal(result.status, 200);
  assert.equal(f.calls[0].sql, 'BEGIN');
  assert.ok(f.calls.some(call => /DELETE FROM mural_leituras/.test(call.sql)));
  assert.equal(f.calls.find(call => call.audit).audit.userId, 10);
  assert.equal(f.calls.at(-1).sql, 'COMMIT');
});

test('visible board query filters by publisher group, publication dates and outing time', async () => {
  const { getVisiblePosts } = await loadModule('../../app/lib/congregation-board-server.js');
  let captured;
  await getVisiblePosts({ query: async (sql, params) => { captured = { sql, params }; return { rows: [] }; } }, 10);
  assert.deepEqual(captured.params, [10]);
  for (const filter of ['m.grupo_id = p.grupo_id', 'm.inicio <=', 'm.fim >=', 'm.data + m.horario::time', 'l.publicador_id = p.id']) assert.ok(captured.sql.includes(filter));
});

test('overview excludes cancelled meetings and publishes programme titles without private metadata', async () => {
  const { addCalendarDays } = await loadModule('../../app/lib/meeting-calendar.js');
  let userId = 10;
  let reads = 0;
  const route = loadRoute('../../app/api/visao-geral/route.js', {
    Pool: class { connect() { return { release() {}, query: async sql => {
      reads++;
      if (sql.includes('FROM reunioes_registro')) return { rows: [
        { id: 1, data: '2099-01-07', tipo: 'Meio de Semana', cancelada: false },
        { id: 2, data: '2099-01-08', tipo: 'Meio de Semana', cancelada: true },
      ] };
      if (sql.includes('FROM reunioes_dados')) return { rows: [{ data_reuniao: '2099-01-07', dados_json: {
        bibleReading: 'Provérbios 1', treasures: [{ title: 'Leitura da Bíblia', duration: 4, email: 'private@example.com' }],
        assignments: { aluno: { email: 'private@example.com' } }, source: { internal: 'private' },
      } }] };
      return { rows: [] };
    } }; } },
    getUserIdFromRequest: () => userId, getUserAccess: async () => ({ user: { privilegios: [] } }),
    addCalendarDays, getCalendarContext: async () => ({}),
    withCalendarState: row => ({ ...row, cancelado: row.cancelada }),
    ensureBoardTables: async () => {}, getVisiblePosts: async () => [],
    getPublisherAssignments: async (_client, options) => { assert.equal(options.publisherId, 10); return []; },
    recordOverviewChanges: async (_client, id) => { assert.equal(id, 10); return []; },
    getOwnFieldGroup: async (_client, id) => { assert.equal(id, 10); return null; },
  });
  userId = null;
  assert.equal((await route.GET(request({}))).status, 401); assert.equal(reads, 0);
  userId = 10;
  const response = await route.GET(request({}));
  assert.equal(response.status, 200);
  assert.equal(response.body.meetings.length, 1);
  assert.equal(response.body.meetings[0].programacao.secoes[0].partes[0].titulo, 'Leitura da Bíblia');
  assert.ok(!JSON.stringify(response.body).includes('private'));
});
