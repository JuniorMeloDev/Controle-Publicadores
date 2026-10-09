import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const reset = await loadModule('../../app/lib/password-reset.js');
const { buildPasswordResetEmail } = await loadModule('../../app/lib/password-reset-email.js');

test('personalized email escapes names and links and includes HTML and plain text', () => {
  const link = 'https://example.com/redefinir-senha?token=abc&source=email';
  const message = buildPasswordResetEmail({ name: 'João <script>alert(1)</script>', link });
  assert.match(message.text, /Olá, João/);
  assert.match(message.text, /30 minutos/);
  assert.ok(message.text.includes(link));
  assert.match(message.html, /João &lt;script&gt;/);
  assert.ok(!message.html.includes('<script>'));
  assert.ok(message.html.includes('token=abc&amp;source=email'));
  assert.match(message.html, /Redefinir minha senha/);
  assert.match(message.html, /Não solicitou esta alteração/);
  assert.match(message.html, /Mensagem automática/);
  assert.match(buildPasswordResetEmail({ name: null, link }).text, /Olá, publicador!/);
  assert.throws(() => buildPasswordResetEmail({ name: 'João', link: 'javascript:alert(1)' }));
});

test('reset validates tokens and passwords, including bcrypt byte limit', () => {
  assert.equal(reset.isValidResetToken('a'.repeat(64)), true);
  for (const value of [null, 123, 'abc', 'z'.repeat(64)]) assert.equal(reset.isValidResetToken(value), false);
  assert.equal(reset.isValidPassword('NovaSenha1!'), true);
  for (const value of [null, '', 'novasenha1!', 'NovaSenha!', 'Aa1!' + 'é'.repeat(35)]) assert.equal(reset.isValidPassword(value), false);
  assert.equal(reset.hashResetToken('a'.repeat(64)).length, 64);
  assert.notEqual(reset.hashResetToken('a'.repeat(64)), 'a'.repeat(64));
});

test('issuance stores a hash and enforces expiration and cooldown', async () => {
  let query;
  let params;
  const client = { async query(sql, values) { query = sql; params = values; return { rows: [{ publicador_id: 1 }] }; } };
  const token = await reset.issuePasswordReset(client, 'user@example.com');
  assert.equal(reset.isValidResetToken(token), true);
  assert.equal(params[1], reset.hashResetToken(token));
  assert.match(query, /INTERVAL '30 minutes'/);
  assert.match(query, /INTERVAL '2 minutes'/);
  assert.equal(await reset.issuePasswordReset({ query: async () => ({ rows: [] }) }, 'unknown@example.com'), null);
});

test('consumption deletes token atomically and rejects expired, used or changed-password links', async () => {
  let sql;
  const client = { async query(query) { sql = query; return { rows: [{ id: 1 }] }; } };
  assert.equal(await reset.consumePasswordReset(client, 'a'.repeat(64), 'hash'), true);
  assert.match(sql, /DELETE FROM password_resets/);
  assert.match(sql, /expires_at > NOW\(\)/);
  assert.match(sql, /p.senha = c.password_hash/);
  assert.equal(await reset.consumePasswordReset({ query: async () => ({ rows: [] }) }, 'a'.repeat(64), 'hash'), false);
});

test('reset API rejects invalid data and clears login cookie on success', async () => {
  let released = 0;
  const client = { release() { released++; } };
  const { POST } = loadRoute('../../app/api/redefinir-senha/route.js', {
    Pool: class { async connect() { return client; } },
    bcrypt: { hash: async () => 'new-hash' },
    ...reset, ensurePasswordResetTable: async () => {}, consumePasswordReset: async () => true,
    NextResponse: { json: (body, options = {}) => ({ body, ...options, status: options.status || 200 }) },
  });
  const request = body => ({ json: async () => body });
  assert.equal((await POST(request({ token: 'bad', novaSenha: 'NovaSenha1!' }))).status, 400);
  assert.equal((await POST(request({ token: 'a'.repeat(64), novaSenha: null }))).status, 400);
  const result = await POST(request({ token: 'a'.repeat(64), novaSenha: 'NovaSenha1!' }));
  assert.equal(result.status, 200);
  assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal(released, 1);
});
