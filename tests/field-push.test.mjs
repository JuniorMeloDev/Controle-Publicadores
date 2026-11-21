import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { deliverFieldPushes, deliverGeneralPushes } from '../app/lib/field-push.js';
import { handleDevicePush } from '../app/lib/device-push-api.js';
import { canAccessRoute } from '../app/lib/route-access.js';
import { fieldNoticeFromHash } from '../app/lib/push-client.js';
import { isPushId, parsePushSubscription, PUSH_DEVICE_COOKIE } from '../app/lib/push-subscriptions.js';
import { loadRoute } from './helpers/load-source.mjs';

const deviceId = 'f80c2365-2ceb-45c5-ac79-cf22b8607cbf';
const keys = { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) };
const endpoint = name => `https://fcm.googleapis.com/fcm/send/fixture-${name}`;
const vapid = { publicKey: 'test-public-key', privateKey: 'test-private-key', subject: 'mailto:test@example.com' };
const origin = 'https://fixture.example';
const headers = new Headers({ origin });

test('subscription endpoint is validated and mutations bind the session and current device', async () => {
  const cookies = { get: key => key === PUSH_DEVICE_COOKIE ? { value: deviceId } : undefined };
  let authorized = true;
  const calls = [];
  const route = loadRoute('../../app/api/admin/notificacoes/web-push/route.js', {
    authorizeRequest: async () => authorized ? null : { status: 401 },
    handleDevicePush: (request, method, options) => handleDevicePush(request, method, { ...options, vapid }),
    getUserIdFromRequest: () => 101,
    Pool: class { async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ endpoint: endpoint('a'), chave_vapid: vapid.publicKey, campo: true }] };
    } },
  });
  const request = (subscription, userId = 101) => ({ cookies, headers, url: origin,
    json: async () => ({ userId, publicKey: vapid.publicKey, subscription }) });
  assert.equal((await route.PUT(request({ endpoint: endpoint('a'), keys }, 102))).status, 409);
  for (const address of ['http://127.0.0.1', 'https://fcm.googleapis.com.fixture.test/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x', 'https://fcm.googleapis.com/other', 'https://localhost:443/']) {
    assert.equal((await route.PUT(request({ endpoint: address, keys }))).status, 400);
  }
  assert.equal((await route.PUT(request({ endpoint: endpoint('expired'), keys, expirationTime: 1 }))).status, 400);
  assert.ok(parsePushSubscription({ endpoint: 'https://fcm.googleapis.com/wp/fixture', keys }));
  assert.ok(parsePushSubscription({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/fixture', keys }));
  assert.ok(parsePushSubscription({ endpoint: 'https://web.push.apple.com/fixture', keys }));
  assert.equal(calls.length, 0);
  const activated = await route.PUT(request({ endpoint: endpoint('a'), keys }));
  assert.equal(activated.status, 200);
  assert.equal(calls[0].params[0], deviceId);
  assert.equal(calls[0].params[1], 101);
  assert.match(activated.headers.get('set-cookie'), /HttpOnly/i);
  const status = await (await route.GET({ cookies })).json();
  assert.equal(status.endpoint, endpoint('a'));
  assert.equal(status.enabled, true);
  assert.equal(Object.values(status).includes(vapid.privateKey), false);
  assert.equal((await route.DELETE(request(null, 102))).status, 409);
  assert.equal((await route.DELETE(request(null))).status, 200);
  assert.match(calls.at(-1).sql, /WHERE aparelho_id = \$1 AND publicador_id = \$2/);
  authorized = false;
  assert.equal((await route.GET({ cookies })).status, 401);
  assert.equal(calls.length, 3);
});

test('guests can opt in to general pushes with a same-origin request and no publisher identity', async () => {
  const calls = [];
  const route = loadRoute('../../app/api/notificacoes/web-push/route.js', {
    getUserIdFromRequest: () => null,
    handleDevicePush: (request, method, options) => handleDevicePush(request, method, { ...options, vapid }),
    Pool: class { async query(sql, params) { calls.push({ sql, params }); return { rows: [] }; } },
  });
  const request = { url: origin, headers, cookies: { get: () => ({ value: deviceId }) },
    json: async () => ({ userId: null, publicKey: vapid.publicKey, subscription: { endpoint: endpoint('guest'), keys } }) };
  assert.equal((await route.PUT({ ...request, headers: new Headers({ origin: 'https://different.example' }) })).status, 403);
  assert.equal((await route.PUT({ ...request, json: async () => ({ userId: 101 }) })).status, 409);
  assert.equal(calls.length, 0);
  assert.equal((await route.PUT(request)).status, 200);
  assert.deepEqual(calls[0].params.slice(0, 4), [deviceId, null, true, endpoint('guest')]);
  assert.equal((await route.DELETE(request)).status, 200);
  assert.match(calls[1].sql, /SET avisos_gerais = FALSE WHERE aparelho_id = \$1/);
});

test('Agenda schedules push only for notifications changed by the committed transaction', async () => {
  const events = [], deferred = [];
  let changed = true, auditFails = false;
  const route = loadRoute('../../app/api/admin/servico-campo/route.js', {
    Pool: class { async connect() { return { query: async sql => events.push(sql), release() {} }; } },
    mutateFieldService: async () => ({ id: 72, ids: [72], notificacoes: Number(changed), pushIds: changed ? ['9421'] : [] }),
    getUserIdFromRequest: () => 101,
    registerAuditLog: async () => { if (auditFails) throw new Error('fixture'); events.push('AUDIT'); },
    after: callback => { events.push('AFTER'); deferred.push(callback); },
    deliverFieldPushes: async (_pool, ids) => events.push(...ids),
  });
  const request = { json: async () => ({ action: 'notify', entity: 'saidas', id: 72 }) };
  const first = await route.POST(request);
  assert.equal(first.body.notificacoes, 1);
  assert.equal(first.body.pushIds, undefined);
  assert.deepEqual(events, ['BEGIN', 'AUDIT', 'COMMIT', 'AFTER']);
  await deferred[0]();
  assert.equal(events.at(-1), '9421');
  changed = false;
  assert.equal((await route.POST(request)).body.notificacoes, 0);
  changed = auditFails = true;
  assert.equal((await route.POST(request)).status, 500);
  assert.equal(events.at(-1), 'ROLLBACK');
  assert.equal(deferred.length, 1);
});

test('delivery uses only the changed notices and removes 404/410 subscriptions without leaking map details', async () => {
  const subscriptions = ['a', 'b', 'expired', 'missing', 'temporary'].map((name, index) => ({
    aparelho_id: `test-${name}`, publicador_id: index < 2 ? 101 : 102,
    endpoint: endpoint(name), chaves: keys, aviso_id: index < 2 ? '9421' : '9422', saida_id: 72,
  }));
  const cleaned = [], sent = [];
  const db = { async query(sql, params) {
    if (sql.includes('expira_em <= NOW()')) return;
    if (sql.includes('JOIN')) {
      assert.match(sql, /JOIN web_push_inscricoes s USING \(publicador_id\)/);
      assert.deepEqual(params, [['9421', '9422'], vapid.publicKey]);
      return { rows: subscriptions };
    }
    assert.match(sql, /aparelho_id = \$1 AND endpoint = \$2 AND chaves = \$3/);
    cleaned.push(params.slice(0, 2));
  } };
  await deliverFieldPushes(db, ['9421', '9422'], { vapid, send: async (subscription, payload) => {
    sent.push([subscription.endpoint, JSON.parse(payload)]);
    const failures = { expired: 410, missing: 404, temporary: 503 };
    const statusCode = failures[subscription.endpoint.split('fixture-').at(-1)];
    if (statusCode) throw Object.assign(new Error('provider fixture'), { statusCode });
  } });
  assert.deepEqual(sent, subscriptions.map(row => [row.endpoint, { noticeId: row.aviso_id, outingId: 72 }]));
  assert.deepEqual(cleaned, [[ 'test-expired', endpoint('expired') ], [ 'test-missing', endpoint('missing') ]]);
});

test('general delivery selects only general opt-ins and sends the public message', async () => {
  const sent = [];
  const db = { async query(sql, params) {
    if (sql.startsWith('DELETE')) return;
    assert.match(sql, /WHERE avisos_gerais AND chave_vapid = \$1/);
    assert.deepEqual(params, [vapid.publicKey]);
    return { rows: [{ endpoint: endpoint('general'), chaves: keys }] };
  } };
  await deliverGeneralPushes(db, { id: deviceId, titulo: 'Aviso fictício', mensagem: 'Mensagem pública de teste.' }, {
    vapid, send: async (subscription, payload) => sent.push([subscription.endpoint, JSON.parse(payload)]),
  });
  assert.deepEqual(sent, [[endpoint('general'), { generalId: deviceId, title: 'Aviso fictício', body: 'Mensagem pública de teste.' }]]);
});

test('publishing general notices is restricted to super admins and duplicate requests do not send again', async () => {
  const path = '/api/admin/notificacoes/avisos-gerais';
  assert.equal(canAccessRoute({ isSuperAdmin: false }, path, 'POST'), false);
  assert.equal(canAccessRoute({ isSuperAdmin: true }, path, 'POST'), true);
  const events = [], deferred = [];
  let exists = false, allowed = false;
  const route = loadRoute('../../app/api/admin/notificacoes/avisos-gerais/route.js', {
    authorizeRequest: async () => allowed ? null : { status: 403 },
    isPushId, fieldPushVapid: () => vapid, getUserIdFromRequest: () => 101,
    Pool: class { async connect() { return { query: async (sql, params) => {
      if (!params) { events.push(sql); return; }
      assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/);
      if (exists) return { rows: [] };
      exists = true;
      return { rows: [{ id: params[0], titulo: params[1], mensagem: params[2] }] };
    }, release() {} }; } },
    registerAuditLog: async () => events.push('AUDIT'),
    after: callback => { events.push('AFTER'); deferred.push(callback); },
    deliverGeneralPushes: async (_pool, notice) => events.push(notice.id),
  });
  const request = { json: async () => ({ id: deviceId, title: ' Horário ', message: ' Aviso de teste. ' }) };
  assert.equal((await route.POST(request)).status, 403);
  allowed = true;
  assert.equal((await route.POST(request)).status, 201);
  assert.deepEqual(events, ['BEGIN', 'AUDIT', 'COMMIT', 'AFTER']);
  assert.equal((await route.POST(request)).body.published, false);
  assert.equal(deferred.length, 1);
  await deferred[0]();
  assert.equal(events.at(-1), deviceId);
});

test('service worker displays generic copy and opens the exact notice with or without an existing window', async () => {
  const listeners = {}, shown = [], opened = [], focused = [];
  let tabs = [];
  const origin = 'https://pwa.example.test';
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL, Request: class {},
    self: {
      location: { origin }, addEventListener: (type, callback) => { listeners[type] = callback; },
      registration: { showNotification: async (title, options) => shown.push({ title, ...options }) },
      clients: { matchAll: async () => tabs, openWindow: async url => opened.push(url) },
    },
  });
  async function dispatch(type, details) {
    let completion;
    listeners[type]({ ...details, waitUntil: promise => { completion = promise; } });
    await completion;
  }
  await dispatch('push', { data: { json: () => ({ noticeId: '9421', outingId: 72, maps: 'ignored' }) } });
  assert.equal(shown[0].body, 'Sua programação de campo foi atualizada');
  assert.deepEqual(Object.keys(shown[0].data), ['noticeId']);
  const notification = { ...shown[0], close() {} };
  await dispatch('notificationclick', { notification });
  assert.equal(fieldNoticeFromHash(new URL(opened[0]).hash), 'campo-saida:9421');
  tabs = [{ url: origin + '/admin/designacoes', navigate: async url => ({ focus: () => focused.push(url) }) }];
  await dispatch('notificationclick', { notification });
  assert.deepEqual(focused, [opened[0]]);
  assert.equal(opened.length, 1);
  tabs = [];
  await dispatch('push', { data: { json: () => ({ generalId: deviceId, title: 'Aviso de teste', body: 'Mensagem pública' }) } });
  assert.equal(shown[1].body, 'Mensagem pública');
  await dispatch('notificationclick', { notification: { ...shown[1], close() {} } });
  assert.equal(opened[1], origin + '/avisos/' + deviceId);
});
