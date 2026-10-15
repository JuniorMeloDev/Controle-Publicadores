import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { getCadastroProgress } = await loadModule('../../app/lib/cadastro-progress.js');
test('progress counts submissions independently of approval and missing changes', async () => {
  const rows = [{ id: 1, nome_completo: 'Confirmou sem alterações', enviado_em: '2026-10-14T12:00:00Z', pendentes: 0 }, { id: 2, nome_completo: 'Enviou alterações', enviado_em: '2026-10-14T13:00:00Z', pendentes: 2 }, { id: 3, nome_completo: 'Ainda falta', enviado_em: null, pendentes: 0 }];
  let sql;
  const result = await getCadastroProgress({ query: async query => { sql = query; return { rows }; } });
  assert.equal(result.total, 3); assert.equal(result.enviados, 2); assert.equal(result.faltam, 1);
  assert.ok(sql.includes('g.ativo = TRUE'));
  assert.ok(!sql.includes('SELECT p.*'));
});
test('progress endpoint is restricted to super admins and never reads data when denied', async () => {
  for (const allowed of [false, true]) {
    let reads = 0;
    const client = { query: async () => { reads++; return { rows: [] }; }, release() {} };
    const route = loadRoute('../../app/api/admin/atualizacoes-cadastrais/route.js', {
      cadastroPool: { connect: async () => client }, ensureCadastroTables: async () => {},
      getUserIdFromRequest: () => 1, getUserAccess: async () => ({ isSuperAdmin: allowed }), getCadastroProgress
    });
    const response = await route.GET({ url: 'http://localhost/api/admin/atualizacoes-cadastrais?acompanhamento=1' });
    assert.equal(response.status, allowed ? 200 : 403);
    assert.equal(reads, allowed ? 1 : 0);
    if (allowed) assert.equal(response.body.total, 0);
  }
});
