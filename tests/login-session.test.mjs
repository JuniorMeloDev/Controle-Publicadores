import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
import { pushDeviceId, revokePushDevice, PUSH_DEVICE_COOKIE } from '../app/lib/push-subscriptions.js';

const secret = 'fictional-login-session-test-secret';
const password = 'fictional-password';
const passwordHash = await bcrypt.hash(password, 4);
const source = readFileSync(new URL('../app/api/login/route.js', import.meta.url), 'utf8')
  .replace(/^import .*\r?\n/gm, '').replace(/export /g, '');

function loginRoute(onRevoke = async () => ({ rowCount: 0 })) {
  const context = vm.createContext({
    process: { env: { JWT_SECRET: secret, NODE_ENV: 'production' } },
    console, bcrypt, jwt, serialize, pushDeviceId, revokePushDevice,
    Pool: class {
      async connect() {
        return {
          query: async (sql, params) => sql.startsWith('UPDATE web_push_inscricoes') ? onRevoke(sql, params)
            : { rows: [{ id: 990001, nome_completo: 'Publicador fictício', senha: passwordHash }] },
          release() {},
        };
      }
    },
    NextResponse: { json: (body, options) => ({ body, ...options }) },
  });
  vm.runInContext(source + '\nglobalThis.handler = POST;', context);
  return context.handler;
}

test('login uses matching JWT and cookie lifetimes and extends only explicit remember-device requests', async () => {
  const login = loginRoute();
  for (const value of [undefined, false, true, 'true', 'false', 1]) {
    const response = await login({ cookies: { get: () => undefined }, json: async () => ({ email: 'ficticio@example.com', senha: password, manterConectado: value }) });
    assert.equal(response.status, 200);
    const cookie = response.headers['Set-Cookie'];
    const claims = jwt.verify(parse(cookie).auth_token, secret);
    const expected = value === true ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
    assert.equal(claims.exp - claims.iat, expected);
    assert.match(cookie, new RegExp(`Max-Age=${expected}(;|$)`));
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag));
    assert.throws(() => jwt.verify(parse(cookie).auth_token, secret, { clockTimestamp: claims.exp }), /expired/);
  }
});

test('remember-device option does not allow login with an incorrect password', async () => {
  const response = await loginRoute()({ json: async () => ({ email: 'ficticio@example.com', senha: 'wrong-password', manterConectado: true }) });
  assert.equal(response.status, 401);
  assert.equal(response.headers, undefined);
});

test('login revokes the current device only if it belongs to a different publisher', async () => {
  const deviceId = 'f80c2365-2ceb-45c5-ac79-cf22b8607cbf';
  const login = loginRoute(async (sql, params) => {
    assert.match(sql, /^UPDATE web_push_inscricoes SET publicador_id = NULL/);
    assert.match(sql, /WHERE aparelho_id = \$1[\s\S]+publicador_id <> \$2/);
    assert.deepEqual(params, [deviceId, 990001]);
    return { rowCount: 1 };
  });
  const response = await login({
    cookies: { get: key => key === PUSH_DEVICE_COOKIE ? { value: deviceId } : undefined },
    json: async () => ({ email: 'ficticio@example.com', senha: password }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.pushRevoked, true);
});
