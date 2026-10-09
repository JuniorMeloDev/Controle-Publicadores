import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';
const helpers = await loadModule('../../app/lib/emergency-contacts.js');
const contactsUrl = 'data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../app/lib/emergency-contacts.js', import.meta.url), 'utf8')).toString('base64');
const serverSource = readFileSync(new URL('../app/lib/emergency-contacts-server.js', import.meta.url), 'utf8').replace("'./emergency-contacts'", JSON.stringify(contactsUrl));
const { saveEmergencyContacts } = await import('data:text/javascript;base64,' + Buffer.from(serverSource).toString('base64'));
const contacts = [{ nome: 'Maria', telefone: '11999991234' }, { nome: 'Joao', telefone: '11988884567' }];
const body = { nome_completo: 'Fulano', data_nascimento: '01/01/2000', nome_grupo: 'Grupo Exemplo', sexo: 'Masculino', privilegios: [], designacoes: [], contatos_emergencia: contacts };
const request = value => ({ json: async () => value });
function dependencies(client) {
  return { ...helpers, saveEmergencyContacts, ensureEmergencyContactsColumn: async () => {},
    Pool: class { connect() { return client; } }, getUserIdFromRequest: () => 7,
    getUserPermissions: async () => ({}), isAllowed: () => true, registerAuditLog: async () => {},
  };
}
test('new publisher stores all emergency contacts as JSON in the same transaction', async () => {
  const queries = [];
  const client = { query: async (sql, params) => { queries.push({ sql, params }); return { rows: sql.includes('SELECT id FROM grupos') ? [{ id: 10 }] : [] }; }, release() {} };
  const route = loadRoute('../../app/api/admin/criar-publicador/route.js', dependencies(client));
  assert.equal((await route.POST(request(body))).status, 201);
  const insert = queries.find(q => q.sql.includes('INSERT INTO publicadores'));
  assert.match(insert.sql, /contatos_emergencia/);
  assert.deepEqual(JSON.parse(insert.params[18]), contacts);
  assert.equal(queries.find(q => q.sql === 'BEGIN').sql, 'BEGIN');
  assert.equal(queries.at(-1).sql, 'COMMIT');
});
test('publisher creation rolls back if its audit fails', async () => {
  const queries = [];
  const client = { query: async sql => { queries.push(sql); return { rows: sql.includes('SELECT id FROM grupos') ? [{ id: 10 }] : [] }; }, release() {} };
  const route = loadRoute('../../app/api/admin/criar-publicador/route.js', { ...dependencies(client), registerAuditLog: async () => { throw new Error('database failure'); } });
  assert.equal((await route.POST(request(body))).status, 500);
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.equal(queries.includes('COMMIT'), false);
});
function updateRoute(client) {
  const source = readFileSync(new URL('../app/api/admin/update-publicador/[id]/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const context = vm.createContext({ ...dependencies(client), process: { env: {} }, console: { error() {} },
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } });
  vm.runInContext(source + '\nglobalThis.handler = PUT;', context);
  return context.handler;
}
test('editing replaces or removes contacts, registers history, and preserves them for older clients', async () => {
  const queries = [];
  const previous = { id: 99, nome_completo: 'Fulano', data_nascimento: '2000-01-01', sexo: 'Masculino', grupo_id: 10, contatos_emergencia: contacts };
  const client = { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('SELECT id FROM grupos')) return { rows: [{ id: 10 }] };
    if (sql.includes('SELECT * FROM publicadores')) return { rows: [previous] };
    if (sql.includes('SELECT nome_grupo')) return { rows: [{ nome_grupo: 'Grupo Exemplo' }] };
    return { rows: [] };
  }, release() {} };
  const route = updateRoute(client);
  assert.equal((await route(request({ ...body, contatos_emergencia: [contacts[0]] }), { params: Promise.resolve({ id: '99' }) })).status, 200);
  const update = queries.find(q => q.sql.includes('SET contatos_emergencia'));
  assert.deepEqual(JSON.parse(update.params[0]), [contacts[0]]);
  const history = queries.find(q => q.sql.includes("VALUES ($1, 'contatos_emergencia'"));
  assert.deepEqual(JSON.parse(history.params[1]), contacts);
  assert.deepEqual(JSON.parse(history.params[2]), [contacts[0]]);
  queries.length = 0;
  const legacy = { ...body }; delete legacy.contatos_emergencia;
  assert.equal((await route(request(legacy), { params: Promise.resolve({ id: '99' }) })).status, 200);
  assert.equal(queries.some(q => q.sql.includes('SET contatos_emergencia')), false);
  queries.length = 0;
  assert.equal((await route(request({ ...body, contatos_emergencia: [] }), { params: Promise.resolve({ id: '99' }) })).status, 200);
  assert.equal(queries.find(q => q.sql.includes('SET contatos_emergencia')).params[0], '[]');
});
test('invalid emergency contacts are rejected before touching the database', async () => {
  let connects = 0;
  const route = loadRoute('../../app/api/admin/criar-publicador/route.js', { ...helpers, Pool: class { connect() { connects++; } } });
  const response = await route.POST(request({ ...body, contatos_emergencia: [{ nome: 'Maria', telefone: '' }] }));
  assert.equal(response.status, 400); assert.equal(connects, 0);
});
