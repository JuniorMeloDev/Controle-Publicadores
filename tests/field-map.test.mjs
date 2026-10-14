import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { prepareFieldMap, saveFieldMap, MAX_FIELD_MAP_BYTES } = await loadModule('../../app/lib/field-map.js');
const { fieldId } = await loadModule('../../app/lib/field-service.js');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const file = (name = 'mapa.pdf', buffer = pdf, size = buffer.length) => ({ name, size, arrayBuffer: async () => buffer });

test('PDF maps validate size, extension and actual content, sanitizing file names', async () => {
  for (const item of [file('mapa.txt'), file('mapa.pdf', Buffer.from('<html>fake</html>')), file('mapa.pdf', Buffer.from('%PDF-1.4 invalid')), file('mapa.pdf', pdf, MAX_FIELD_MAP_BYTES + 1), file('mapa.pdf', Buffer.alloc(MAX_FIELD_MAP_BYTES + 1), 10)]) await assert.rejects(prepareFieldMap(item));
  const prepared = await prepareFieldMap(file('../mapa\n.pdf'));
  assert.equal(prepared.name, 'mapa.pdf');
  assert.deepEqual(prepared.buffer, pdf);
  const fullSize = Buffer.alloc(MAX_FIELD_MAP_BYTES, 32);
  fullSize.write('%PDF-1.4');
  fullSize.write('%%EOF', fullSize.length - 5);
  assert.equal((await prepareFieldMap(file('mapa-grande.pdf', fullSize))).buffer.length, 10 * 1024 * 1024);
});

function fixture({ allowed = true, auditFails = false, found = true } = {}) {
  const calls = [];
  class Response {
    constructor(body, options) { this.body = body; Object.assign(this, options); this.status ||= 200; }
    static json(body, options = {}) { return { body, status: options.status || 200 }; }
  }
  const route = loadRoute('../../app/api/admin/servico-campo/mapas/route.js', {
    Pool: class { async connect() { return { release() {}, query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: sql.startsWith('SELECT nome') ? found ? [{ nome: 'mapa.pdf', conteudo: pdf }] : [] : sql.startsWith('SELECT id') ? [{ id: 2 }] : [] };
    } }; } }, NextResponse: Response,
    authorizeRequest: async () => allowed ? null : { status: 403 },
    getUserIdFromRequest: () => 1, fieldId, prepareFieldMap, saveFieldMap,
    registerAuditLog: async () => { calls.push({ sql: 'AUDIT' }); if (auditFails) throw new Error('Audit failed'); }
  });
  return { route, calls };
}
const upload = () => ({ formData: async () => new Map([['territorio', '2'], ['arquivo', file()]]) });
test('map reads and uploads require authorization before any database access', async () => {
  const denied = fixture({ allowed: false });
  assert.equal((await denied.route.GET({ url: 'https://example.com/api/admin/servico-campo/mapas' })).status, 403);
  assert.equal((await denied.route.POST(upload())).status, 403);
  assert.equal(denied.calls.length, 0);
});
test('maps can be viewed inline or downloaded, with private responses and parameterized selection', async () => {
  const fixtureData = fixture();
  const response = await fixtureData.route.GET({ url: 'https://example.com/api/admin/servico-campo/mapas?territorio=2&download=1' });
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'application/pdf');
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.ok(response.headers['Content-Disposition'].startsWith('attachment;'));
  assert.equal(fixtureData.calls[0].params[0], 'territorio-2');
  const inline = await fixtureData.route.GET({ url: 'https://example.com/api/admin/servico-campo/mapas' });
  assert.ok(inline.headers['Content-Disposition'].startsWith('inline;'));
  assert.equal((await fixture({ found: false }).route.GET({ url: 'https://example.com/api/admin/servico-campo/mapas' })).status, 404);
});
test('map replacements are audited in the same transaction and failures roll back', async () => {
  const valid = fixture();
  assert.equal((await valid.route.POST(upload())).status, 200);
  assert.equal(valid.calls.at(-2).sql, 'AUDIT');
  assert.equal(valid.calls.at(-1).sql, 'COMMIT');
  assert.ok(valid.calls.some(call => call.sql.includes('ON CONFLICT (chave) DO UPDATE')));
  const failed = fixture({ auditFails: true });
  assert.equal((await failed.route.POST(upload())).status, 500);
  assert.equal(failed.calls.at(-1).sql, 'ROLLBACK');
});
