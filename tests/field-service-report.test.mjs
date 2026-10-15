import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { fieldDate } = await loadModule('../../app/lib/field-service.js');
function setup(denied = null) {
  const queries = [];
  const handlers = loadRoute('../../app/api/admin/relatorios/servico-campo/route.js', {
    fieldDate,
    authorizeRequest: async () => denied,
    Pool: class { async query(sql, params) { queries.push({ sql, params }); return { rows: [] }; } }
  });
  return { ...handlers, queries };
}
const request = query => ({ url: `https://example.com/api/admin/relatorios/servico-campo?${query}` });

test('field report rejects missing, invalid and reversed dates before querying', async () => {
  const { GET, queries } = setup();
  for (const query of ['', 'start=2026-02-30&end=2026-03-01', 'start=2026-10-31&end=2026-10-01']) {
    assert.equal((await GET(request(query))).status, 400);
  }
  assert.equal(queries.length, 0);
});
test('field report uses inclusive parameterized dates and chronological order', async () => {
  const { GET, queries } = setup();
  assert.equal((await GET(request('start=2026-10-01&end=2026-10-31'))).status, 200);
  assert.deepEqual(Array.from(queries[0].params), ['2026-10-01', '2026-10-31']);
  assert.match(queries[0].sql, /BETWEEN \$1::date AND \$2::date/);
  assert.match(queries[0].sql, /ORDER BY s.data, s.horario, s.id/);
  assert.match(queries[0].sql, /t.id = ANY\(s.territorios\)/);
  assert.match(queries[0].sql, /t.numero::text, ', ' ORDER BY t.numero/);
  assert.doesNotMatch(queries[0].sql, /data_conclusao/);
});
test('field report honors denied access before database lookup', async () => {
  const { GET, queries } = setup({ status: 403 });
  assert.equal((await GET(request('start=2026-10-01&end=2026-10-31'))).status, 403);
  assert.equal(queries.length, 0);
});
