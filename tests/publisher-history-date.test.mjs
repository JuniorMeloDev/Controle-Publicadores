import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { validatePublisherHistoryDate } = await loadModule('../../app/lib/publisher-history-date.js');

test('history dates accept real calendar dates and reject malformed or impossible dates', () => {
  assert.equal(validatePublisherHistoryDate(undefined), null);
  assert.equal(validatePublisherHistoryDate('2024-02-29'), '2024-02-29T12:00:00-03:00');
  for (const value of ['', '2025-02-29', '2026-04-31', '2026-13-01', '11/11/2026', {}, '2026-11-11T00:00:00Z']) {
    assert.throws(() => validatePublisherHistoryDate(value), /data válida/);
  }
});

function fixture(previous) {
  const history = [];
  let connections = 0;
  const route = loadRoute('../../app/api/admin/update-publicador/[id]/route.js', {
    validatePublisherHistoryDate,
    getUserIdFromRequest: () => 7, getUserPermissions: async () => ({}), isAllowed: () => true,
    ensureEmergencyContactsColumn: async () => {}, registerAuditLog: async () => {},
    Pool: class {
      async connect() {
        connections++;
        return {
          query: async (sql, params) => {
            if (sql.includes('SELECT id FROM grupos')) return { rows: [{ id: 1 }] };
            if (sql.includes('SELECT * FROM publicadores')) return { rows: [{
              nome_completo: 'Publicador fictício', data_nascimento: '2000-01-01', sexo: 'Masculino', ...previous,
            }] };
            if (sql.includes('INSERT INTO publicador_historico')) history.push(params);
            return { rows: [] };
          },
          release() {},
        };
      }
    },
  });
  return { route, history, connections: () => connections };
}

const body = {
  nome_completo: 'Publicador fictício', data_nascimento: '01/01/2000', nome_grupo: 'Grupo fictício',
  sexo: 'Masculino', privilegios: [], designacoes: [],
};
const context = { params: Promise.resolve({ id: '8' }) };

test('granting and removing roles uses the chosen dates only for role history', async () => {
  for (const removing of [false, true]) {
    const f = fixture({ privilegios: removing ? ['servo_ministerial'] : [], designacoes: removing ? ['pioneiro_regular'] : [] });
    const response = await f.route.PUT({ json: async () => ({ ...body,
      telefone: '12345678',
      privilegios: removing ? [] : ['servo_ministerial'], designacoes: removing ? [] : ['pioneiro_regular'],
      data_alteracao_privilegios: '2026-11-04', data_alteracao_designacoes: '2026-11-05',
    }) }, context);
    assert.equal(response.status, 200);
    assert.equal(f.history.find(row => row[1] === 'privilegios')[4], '2026-11-04T12:00:00-03:00');
    assert.equal(f.history.find(row => row[1] === 'designacoes')[4], '2026-11-05T12:00:00-03:00');
    assert.equal(f.history.find(row => row[1] === 'telefone')[4], null);
  }
});

test('missing dates preserve the default date and unchanged roles create no new role events', async () => {
  const f = fixture({ privilegios: [], designacoes: [] });
  assert.equal((await f.route.PUT({ json: async () => ({ ...body, privilegios: ['anciao'] }) }, context)).status, 200);
  assert.equal(f.history.find(row => row[1] === 'privilegios')[4], null);
  const unchanged = fixture({ privilegios: [], designacoes: [] });
  await unchanged.route.PUT({ json: async () => ({ ...body, data_alteracao_privilegios: '2026-11-04' }) }, context);
  assert.ok(!unchanged.history.some(row => ['privilegios', 'designacoes'].includes(row[1])));
});

test('invalid role dates fail before any database changes', async () => {
  const f = fixture({});
  const response = await f.route.PUT({ json: async () => ({ ...body, data_alteracao_privilegios: '2026-02-30' }) }, context);
  assert.equal(response.status, 400);
  assert.equal(f.connections(), 0);
});
