import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import jwt from 'jsonwebtoken';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { requestNotifications } = await loadModule('../../app/lib/notification-client.js');

test('notification client includes the session cookie and sends all selected IDs', async () => {
    let options;
    const response = await requestNotifications({ ids: ['ficticio-alfa', 'ficticio-beta'], fetcher: async (url, input) => {
        assert.equal(url, '/api/admin/notificacoes'); options = input;
        return { ok: true, json: async () => ({ notifications: [], unread: 0 }) };
    } });
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { ids: ['ficticio-alfa', 'ficticio-beta'] });
    assert.equal(response.unread, 0);
});

test('expired session produces an actionable error instead of treating read marking as successful', async () => {
    await assert.rejects(requestNotifications({ ids: ['ficticio-alfa'], fetcher: async () => ({
        ok: false, status: 401, json: async () => ({ message: 'Não autorizado' }),
    }) }), error => error.status === 401 && /sessão expirou/.test(error.message) && /Entre novamente/.test(error.message));
});

test('mark all read persists across reloads and cannot mark another user notifications', async () => {
    const ledger = new Map();
    let userId = 990001;
    const fixture = ['ficticio-alfa', 'ficticio-beta'];
    const route = loadRoute('../../app/api/admin/notificacoes/route.js', {
        getUserIdFromRequest: () => userId,
        todayInBrazil: () => '2030-01-07',
        getPersonalNotifications: async (_client, id) => fixture.map(key => ({
            id: `${key}:${id}`, read: ledger.get(id)?.has(`${key}:${id}`) || false,
        })),
        Pool: class { connect() { return { query: async (sql, params) => {
            assert.match(sql, /INSERT INTO alertas_lidos/);
            const [id, ids] = params;
            if (!ledger.has(id)) ledger.set(id, new Set());
            ids.forEach(key => ledger.get(id).add(key));
            return { rows: [] };
        }, release() {} }; } },
    });
    const initial = await route.GET({});
    assert.equal(initial.body.unread, 2);
    const read = await route.POST({ json: async () => ({ ids: [...initial.body.notifications.map(n => n.id), 'ficticio-alfa:990002'] }) });
    assert.equal(read.status, 200); assert.equal(read.body.unread, 0);
    assert.equal((await route.GET({})).body.unread, 0);
    assert.equal(ledger.get(990001).size, 2);
    userId = 990002;
    assert.equal((await route.GET({})).body.unread, 2);
    userId = null;
    assert.equal((await route.POST({ json: async () => ({ ids: fixture }) })).status, 401);
});

test('middleware authorizes a valid notification POST and rejects an expired session before any write', async () => {
    const secret = 'fictional-notification-test-secret';
    const source = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    const context = vm.createContext({ process: { env: { JWT_SECRET: secret } }, verify: jwt.verify,
        NextResponse: { next: () => ({ status: 200 }), json: (body, options) => ({ body, ...options }) } });
    vm.runInContext(source + '\nglobalThis.handler = middleware;', context);
    const request = token => ({ method: 'POST', nextUrl: { pathname: '/api/admin/notificacoes' },
        cookies: { get: () => token ? { value: token } : undefined } });
    const valid = jwt.sign({ userId: 990001 }, secret, { expiresIn: '1h' });
    const expired = jwt.sign({ userId: 990001, exp: 1 }, secret);
    assert.equal((await context.handler(request(valid))).status, 200);
    assert.equal((await context.handler(request(expired))).status, 401);
    assert.equal((await context.handler(request(null))).status, 401);
});
