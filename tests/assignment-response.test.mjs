import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const responses = await loadModule('../../app/lib/assignment-response.js');
const assignment = { id: 'vida-123', publicador_id: 7, data_reuniao: '2030-01-10', nome_parte: 'Leitura', nome_completo: 'Pessoa fictícia', descricao_semana: 'Semana', reuniao_id: 8 };
const version = responses.assignmentVersion(assignment);

test('assignment versions invalidate old invitations after date, publisher or part changes', () => {
  for (const change of [{ data_reuniao: '2030-01-11' }, { publicador_id: 9 }, { nome_parte: 'Outro' }, { descricao_semana: 'Outra' }, { reuniao_id: 10 }]) {
    assert.notEqual(responses.assignmentVersion({ ...assignment, ...change }), version);
  }
  assert.equal(responses.assignmentVersion({ ...assignment, data_reuniao: new Date('2030-01-10T00:00:00Z') }), version);
});

test('no reply keeps a valid assignment; replies are read from a shared database ledger', async () => {
  const client = { query: async sql => ({ rows: sql.startsWith('SELECT') ? [{ versao: version, resposta: 'sim' }] : [] }) };
  const result = await responses.withAssignmentResponses(client, [assignment, { ...assignment, id: 'vida-124' }]);
  assert.equal(result[0].resposta, 'sim'); assert.equal(result[1].resposta, 'sem_resposta');
  assert.match(responses.responseLabels.sem_resposta, /válida/);
});

test('resends create hashed bearer links and preserve existing answers and invitation tokens', async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  const link = await responses.createResponseLink(client, assignment, 'https://example.test');
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
  assert.match(token, /^[a-f0-9]{64}$/);
  const tokenInsert = calls.find(c => c.sql.startsWith('INSERT INTO designacoes_respostas_tokens'));
  assert.equal(tokenInsert.values[0], responses.hashToken(token));
  assert.ok(!JSON.stringify(calls).includes(token));
  assert.match(calls.find(c => c.sql.includes('(versao, designacao_id')).sql, /ON CONFLICT \(versao\) DO NOTHING/);
  assert.notEqual(link, await responses.createResponseLink(client, assignment, 'https://example.test'));
});

test('only a new refusal enqueues notices, requiring explicit permission or super admin', async () => {
  let changed = true; const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: sql.startsWith('UPDATE') && changed ? [{ versao: version }] : [] }; } };
  assert.equal(await responses.recordAssignmentResponse(client, assignment, 'sim', 'app'), true);
  assert.ok(!calls.some(c => c.sql.includes('INSERT INTO designacoes_recusas_avisos')));
  calls.length = 0;
  assert.equal(await responses.recordAssignmentResponse(client, assignment, 'nao', 'email'), true);
  const notice = calls.find(c => c.sql.includes('INSERT INTO designacoes_recusas_avisos'));
  assert.match(notice.sql, /super_admin=TRUE/); assert.match(notice.sql, /designacoes_confirmacoes/);
  changed = false; calls.length = 0;
  assert.equal(await responses.recordAssignmentResponse(client, assignment, 'nao', 'email'), false);
  assert.ok(!calls.some(c => c.sql.includes('INSERT INTO designacoes_recusas_avisos')));
  await assert.rejects(responses.recordAssignmentResponse(client, assignment, 'maybe', 'app'));
});

function responseRoute({ tokenRows = [{ publicador_id: 7, versao: version }], active = [assignment], userId = 7, recorded = true } = {}) {
  const writes = [];
  return { writes, ...loadRoute('../../app/api/designacoes/resposta/route.js', {
    Pool: class { connect() { return { release() {}, query: async (sql, values) => {
      writes.push({ sql, values });
      if (sql.includes('JOIN designacoes_respostas_tokens')) return { rows: tokenRows };
      return { rows: [{ resposta: 'sim' }] };
    } }; } },
    getUserIdFromRequest: () => userId, getUserAccess: async () => ({}),
    getActiveAssignments: async (_client, options) => { assert.equal(options.publisherId, 7); return active; },
    ensureResponseTables: async () => {}, assignmentVersion: responses.assignmentVersion, hashToken: responses.hashToken,
    recordAssignmentResponse: async () => recorded,
  }) };
}
const request = body => ({ url: 'https://example.test/api/designacoes/resposta', headers: new Headers({ origin: 'https://example.test' }), json: async () => body });

test('email replies do not require a session; expired, cancelled and altered invitations fail closed', async () => {
  const body = { token: 'a'.repeat(64), resposta: 'sim' };
  assert.equal((await responseRoute({ userId: null }).POST(request(body))).status, 200);
  assert.equal((await responseRoute({ tokenRows: [] }).POST(request(body))).status, 410);
  assert.equal((await responseRoute({ active: [] }).POST(request(body))).status, 410);
  assert.equal((await responseRoute({ active: [{ ...assignment, publicador_id: 8 }] }).POST(request(body))).status, 410);
  assert.equal((await responseRoute({ recorded: false }).POST(request(body))).status, 409);
});

test('app response uses authenticated ownership and rejects invalid answers and foreign origins', async () => {
  assert.equal((await responseRoute().POST(request({ versao: version, resposta: 'sim', publicador_id: 99 }))).status, 200);
  assert.equal((await responseRoute({ userId: null }).POST(request({ versao: version, resposta: 'sim' }))).status, 401);
  assert.equal((await responseRoute().POST(request({ versao: version, resposta: 'invalid' }))).status, 400);
  assert.equal((await responseRoute().POST(request(null))).status, 400);
  const foreign = request({ versao: version, resposta: 'sim' }); foreign.headers.set('origin', 'https://foreign.test');
  assert.equal((await responseRoute().POST(foreign)).status, 403);
});

test('invitation preview does not record an answer or start a transaction', async () => {
  const source = readFileSync(new URL('../app/api/designacoes/resposta/route.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  let recorded = false;
  const context = vm.createContext({ URL, process: { env: {} },
    Pool: class { connect() { return { query: async sql => { assert.notEqual(sql, 'BEGIN'); return { rows: sql.includes('JOIN') ? [{ publicador_id: 7, versao: version }] : [{ resposta: 'sem_resposta' }] }; }, release() {} }; } },
    NextResponse: { json: (body, options) => ({ body, ...options }) },
    ensureResponseTables: async () => {}, hashToken: responses.hashToken, assignmentVersion: responses.assignmentVersion,
    getActiveAssignments: async () => [assignment], todayInBrazil: () => '2030-01-07', recordAssignmentResponse: async () => { recorded = true; },
  });
  vm.runInContext(source + '\nglobalThis.preview = PUT;', context);
  const result = await context.preview(request({ token: 'a'.repeat(64) }));
  assert.equal(result.status, 200); assert.equal(recorded, false);
});

function emailModule(dependencies) {
  const source = readFileSync(new URL('../app/lib/assignment-response-email.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const context = vm.createContext({ URL, process: { env: { APP_URL: 'https://example.test', EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'fictional' } },
    ...responses, ensureResponseTables: async () => {}, todayInBrazil: () => '2030-01-07', getActiveAssignments: async () => [assignment],
    escapeEmailHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('&token', '&amp;token'),
    emailSender: address => address, ...dependencies });
  vm.runInContext(source + '\nglobalThis.api = { confirmationEmailContent, deliverRefusalEmails };', context);
  return context.api;
}

test('confirmation email buttons preserve the chosen answer and include plain-text bearer links', async () => {
  const mailApi = emailModule({ createResponseLink: async () => 'https://example.test/confirmar-designacao#token=fixture' });
  const content = await mailApi.confirmationEmailContent({}, [{ ...assignment, nome_parte: '<script>fake</script>' }]);
  assert.ok(!content.html.includes('resposta=sim'));
  assert.match(content.html, /resposta=nao/);
  assert.ok(!content.html.includes('<script>'));
  assert.match(content.text, /#token=fixture&resposta=nao/);
  assert.ok(!content.text.includes('continua válida'));
});

test('SMTP failure leaves refusal email pending for cron and retries recheck current assignments and permission', async () => {
  const calls = []; let fail = true; let sends = 0;
  const mailApi = emailModule({ nodemailer: { createTransport: () => ({ sendMail: async () => { sends++; if (fail) throw new Error('SMTP down'); return { rejected: [] }; } }) } });
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: sql.includes('RETURNING n.id') ? [{ id: 1, email: 'recipient@example.test', dados: assignment }] : [] };
  } };
  await mailApi.deliverRefusalEmails(client);
  assert.equal(sends, 1); assert.ok(!calls.some(c => c.sql.includes('SET enviado_em')));
  const claim = calls.find(c => c.sql.includes('RETURNING n.id'));
  assert.match(claim.sql, /n.enviado_em IS NULL/); assert.match(claim.sql, /15 minutes/);
  assert.match(claim.sql, /designacoes_confirmacoes.*'true'::jsonb/);
  assert.deepEqual(Array.from(claim.values[0]), [version]);
  fail = false; await mailApi.deliverRefusalEmails(client);
  assert.equal(sends, 2); assert.ok(calls.some(c => c.sql.includes('SET enviado_em')));
});

test('confirmation list denies users without explicit access before querying assignments', async () => {
  let queried = false;
  const route = loadRoute('../../app/api/designacoes/confirmacoes/route.js', {
    Pool: class { connect() { return { release() {} }; } }, getUserIdFromRequest: () => 7,
    getUserAccess: async () => ({ permissions: { actions: {} } }),
    getActiveAssignments: async () => { queried = true; return [assignment]; },
  });
  assert.equal((await route.GET({})).status, 403); assert.equal(queried, false);
});
