import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { loadModule, loadRoute } from './helpers/load-source.mjs';
const contactsHelpers = await loadModule('../../app/lib/emergency-contacts.js');
const contactsUrl = 'data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../app/lib/emergency-contacts.js', import.meta.url), 'utf8')).toString('base64');
const helperSource = readFileSync(new URL('../app/lib/cadastro-update.js', import.meta.url), 'utf8').replace("'./emergency-contacts'", JSON.stringify(contactsUrl));
const helpers = await import('data:text/javascript;base64,' + Buffer.from(helperSource).toString('base64'));
const { normalizeDate, normalizeName, personalData, validatePersonalData, planChanges } = helpers;

test('dates reject impossible/future dates and accept Brazilian and ISO dates', () => {
  assert.equal(normalizeDate('29/02/2000'), '2000-02-29');
  assert.equal(normalizeDate('2000-02-29'), '2000-02-29');
  for (const date of ['31/02/2000', '29/02/2001', '01/13/2000', '2100-01-01', '2000-01-01junk']) assert.throws(() => normalizeDate(date));
  assert.equal(normalizeName('  Jos\u00e9  '), 'jose');
});
test('only missing fields apply immediately; corrections are pending and blanks preserve data', () => {
  const snapshot = personalData({ nome_completo: 'Fulano', data_nascimento: '2000-01-01', telefone: '12345' });
  const incoming = validatePersonalData({ ...snapshot, data_nascimento: '2000-02-01', telefone: '', email: 'fulano@example.com', senha: 'ignored' });
  const changes = planChanges(snapshot, incoming, snapshot);
  assert.deepEqual(changes.automatic, [{ field: 'email', old: '', value: 'fulano@example.com' }]);
  assert.deepEqual(changes.pending, [{ field: 'data_nascimento', old: '2000-01-01', value: '2000-02-01' }]);
  assert.equal(incoming.senha, undefined);
});
test('unchanged form fields cannot revert concurrent administrative edits', () => {
  const snapshot = personalData({ nome_completo: 'Fulano', telefone: '12345' });
  const current = { ...snapshot, telefone: '99999', email: 'admin@example.com' };
  assert.deepEqual(planChanges(current, validatePersonalData(snapshot), snapshot), { automatic: [], pending: [] });
  const changes = planChanges(current, validatePersonalData({ ...snapshot, email: 'novo@example.com' }), snapshot);
  assert.equal(changes.automatic.length, 0);
  assert.equal(changes.pending[0].old, 'admin@example.com');
});
test('validates allowed personal fields and excludes all administrative fields', () => {
  assert.throws(() => validatePersonalData({ email: 'invalid' }));
  assert.throws(() => validatePersonalData({ telefone: {} }));
  assert.throws(() => validatePersonalData({ telefone: '1'.repeat(21) }));
  assert.throws(() => validatePersonalData({ estado: 'XX' }));
  assert.equal(validatePersonalData({ estado: 'sp' }).estado, 'SP');
  const data = personalData({ id: 10, senha: 'secret', privilegios: ['anciao'], email: 'a@example.com' });
  assert.equal(data.id, undefined); assert.equal(data.senha, undefined); assert.equal(data.privilegios, undefined);
});

function fixtureClient(query) { return { query, release() {} }; }
const request = body => ({ json: async () => body });
const noop = async () => {};
test('lookup accepts partial names with accents, returns only personal data and rejects ambiguous matches', async () => {
  let candidates = [{ id: 99, nome_completo: 'Jos\u00e9 da Silva', data_nascimento: '2000-01-01', senha: 'secret' }];
  const client = fixtureClient(async sql => ({ rows: sql.startsWith('SELECT p.id') ? candidates : [] }));
  const route = loadRoute('../../app/api/atualizacao-cadastral/buscar/route.js', {
    ...helpers, cadastroPool: { connect: async () => client }, ensureCadastroTables: noop,
    limitCadastroAttempts: async () => true, tokenHash: value => value, randomBytes: () => ({ toString: () => 'a'.repeat(64) }),
  });
  const response = await route.POST(request({ nome: 'Jose Silva', nascimento: '01/01/2000' }));
  assert.equal(response.status, 200); assert.equal(response.body.dados.nome_completo, 'Jos\u00e9 da Silva');
  assert.equal(response.body.dados.senha, undefined); assert.equal(response.body.dados.id, undefined);
  candidates.push({ ...candidates[0], id: 100 });
  const ambiguous = await route.POST(request({ nome: 'Silva', nascimento: '2000-01-01' }));
  assert.equal(ambiguous.status, 404); assert.equal(ambiguous.body.dados, undefined);
  assert.equal((await route.POST(request({ nome: ' ', nascimento: '2000-01-01' }))).status, 400);
});
test('submission binds to stored session, applies missing data, queues corrections, and consumes token', async () => {
  const row = { id: 99, nome_completo: 'Fulano', data_nascimento: '2000-01-01' };
  let used = false; const inserts = []; const applied = [];
  const client = fixtureClient(async (sql, params) => {
    if (sql.includes('SELECT * FROM cadastro_sessoes')) return { rows: used ? [] : [{ publicador_id: 99, snapshot: personalData(row) }] };
    if (sql.includes('SELECT * FROM publicadores')) return { rows: [row] };
    if (sql.includes('INSERT INTO cadastro_alteracoes')) inserts.push(params);
    if (sql.includes('UPDATE cadastro_sessoes')) used = true;
    return { rows: [] };
  });
  const route = loadRoute('../../app/api/atualizacao-cadastral/enviar/route.js', {
    ...helpers, cadastroPool: { connect: async () => client }, ensureCadastroTables: noop,
    limitCadastroAttempts: async () => true, tokenHash: value => value, randomUUID: () => 'submission',
    applyCadastroField: async (...args) => applied.push(args.slice(1)),
  });
  const body = { token: 'a'.repeat(64), publicador_id: 100, dados: { ...personalData(row), email: 'test@example.com', data_nascimento: '2000-02-01' } };
  const response = await route.POST(request(body));
  assert.equal(response.status, 200); assert.equal(response.body.automaticos, 1); assert.equal(response.body.pendentes, 1);
  assert.deepEqual(applied, [[99, 'email', '', 'test@example.com']]);
  assert.deepEqual(inserts.map(values => values[5]), ['automatico', 'pendente']);
  assert.equal((await route.POST(request(body))).status, 401);
});
test('reviews require permissions, apply approved changes, and reject stale proposals', async () => {
  let authorized = true; let stale = false; const applied = []; const queries = [];
  const client = fixtureClient(async (sql, params) => {
    queries.push(sql);
    if (sql.startsWith('SELECT * FROM publicadores')) return { rows: [{ id: 99, nome_completo: stale ? 'Updated' : 'Fulano' }] };
    if (sql.startsWith('SELECT * FROM cadastro_alteracoes')) return { rows: [{ id: 1, publicador_id: 99, campo: 'nome_completo', valor_antigo: 'Fulano', valor_novo: 'Fulano Silva' }] };
    return { rows: [] };
  });
  const route = loadRoute('../../app/api/admin/atualizacoes-cadastrais/route.js', {
    personalData, ...contactsHelpers, cadastroPool: { connect: async () => client }, ensureCadastroTables: noop,
    getUserIdFromRequest: () => 7, getUserPermissions: async () => ({}), isAllowed: () => authorized,
    applyCadastroField: async (...args) => applied.push(args.slice(1)), registerAuditLog: noop,
  });
  assert.equal((await route.POST(request({ ids: [1], acao: 'aprovar' }))).status, 200);
  assert.deepEqual(applied, [[99, 'nome_completo', 'Fulano', 'Fulano Silva']]);
  stale = true;
  assert.equal((await route.POST(request({ ids: [1], acao: 'aprovar' }))).status, 409);
  assert.equal(applied.length, 1); assert.equal(queries.at(-1), 'ROLLBACK');
  assert.equal((await route.POST(request({ ids: [1], acao: 'rejeitar' }))).status, 200);
  assert.equal(applied.length, 1);
  authorized = false;
  assert.equal((await route.GET(request({}))).status, 403);
  assert.equal((await route.POST(request({ ids: [1], acao: 'aprovar' }))).status, 403);
});


test('multiple emergency contacts are validated together and empty rows are ignored', () => {
  const data = validatePersonalData({ contatos_emergencia: [{ nome: ' Maria ', telefone: '(11) 99999-1234' }, { nome: 'Joao', telefone: '(11) 98888-4567' }, { nome: '', telefone: '' }] });
  assert.equal(data.contatos_emergencia.length, 2);
  assert.equal(data.contatos_emergencia[0].nome, 'Maria');
  assert.throws(() => validatePersonalData({ contatos_emergencia: [{ nome: 'Maria', telefone: '' }] }));
  assert.throws(() => validatePersonalData({ contatos_emergencia: [{ nome: '', telefone: '11999991234' }] }));
  assert.throws(() => validatePersonalData({ contatos_emergencia: 'invalid' }));
  assert.throws(() => validatePersonalData({ contatos_emergencia: [{ nome: 'Maria', telefone: '11999991234', senha: 'secret' }, ...Array.from({ length: 10 }, () => ({ nome: 'Maria', telefone: '11999991234' }))] }));
  assert.equal(validatePersonalData({ contatos_emergencia: [{ nome: 'Maria', telefone: '11999991234', senha: 'secret' }] }).contatos_emergencia[0].senha, undefined);
});
test('first emergency contacts apply automatically; changed existing lists require approval', () => {
  const empty = personalData({ nome_completo: 'Fulano' });
  const contacts = [{ nome: 'Maria', telefone: '11999991234' }];
  const first = planChanges(empty, validatePersonalData({ ...empty, contatos_emergencia: contacts }), empty);
  assert.equal(first.automatic.length, 1); assert.equal(first.pending.length, 0);
  assert.equal(first.automatic[0].field, 'contatos_emergencia');
  assert.deepEqual(JSON.parse(first.automatic[0].value), contacts);
  const existing = { ...empty, contatos_emergencia: contacts };
  const second = planChanges(existing, validatePersonalData({ ...existing, contatos_emergencia: [...contacts, { nome: 'Joao', telefone: '11988884567' }] }), existing);
  assert.equal(second.automatic.length, 0); assert.equal(second.pending.length, 1);
  assert.deepEqual(planChanges(existing, validatePersonalData({ ...existing, contatos_emergencia: [] }), existing), { automatic: [], pending: [] });
  assert.deepEqual(planChanges(existing, validatePersonalData(existing), existing), { automatic: [], pending: [] });
  assert.deepEqual(planChanges({ ...existing, contatos_emergencia: [] }, validatePersonalData(existing), existing), { automatic: [], pending: [] });
});
