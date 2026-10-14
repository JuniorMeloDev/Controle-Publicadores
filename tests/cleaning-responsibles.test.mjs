import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, loadRoute } from './helpers/load-source.mjs';

const { getCleaningResponsibles, changeCleaningGroup } = await loadModule('../../app/lib/cleaning-responsibles.js');

test('responsáveis padrão incluem SG e ajudante, um por linha, sem nomes vazios ou repetidos', () => {
  assert.equal(getCleaningResponsibles({ superintendente_nome: ' Junior Melo ', ajudante_nome: 'Paulo Quintas' }), 'Junior Melo\nPaulo Quintas');
  assert.equal(getCleaningResponsibles({ superintendente_nome: 'Junior Melo' }), 'Junior Melo');
  assert.equal(getCleaningResponsibles({ superintendente_nome: 'Junior Melo', ajudante_nome: 'Junior Melo' }), 'Junior Melo');
  assert.equal(getCleaningResponsibles(), '');
});

test('trocar grupo atualiza sugestões e preserva responsáveis manuais', () => {
  assert.equal(changeCleaningGroup('SG anterior\nAjudante anterior', 'SG anterior\nAjudante anterior', 'Novo SG'), 'Novo SG');
  assert.equal(changeCleaningGroup('', '', 'Novo SG'), 'Novo SG');
  assert.equal(changeCleaningGroup('Outro responsável', 'SG anterior', 'Novo SG'), 'Outro responsável');
});

test('consulta dos responsáveis exige autorização antes de acessar o banco', async () => {
  const denied = { status: 403 };
  const route = loadRoute('../../app/api/admin/limpeza/grupos/route.js', {
    authorizeRequest: async () => denied,
    Pool: class { connect() { throw new Error('Não deveria acessar o banco'); } },
  });
  assert.equal(await route.GET({ url: 'http://localhost/api/admin/limpeza/grupos' }), denied);
});

test('consulta dos responsáveis retorna nomes com acesso privado e libera conexão', async () => {
  let released = false;
  const rows = [{ nome_grupo: 'Opala', superintendente_nome: 'Junior Melo', ajudante_nome: 'Paulo Quintas' }];
  const client = { query: async () => ({ rows }), release() { released = true; } };
  const route = loadRoute('../../app/api/admin/limpeza/grupos/route.js', {
    Pool: class { async connect() { return client; } },
    ensureGroupLeadership: async () => {},
  });
  const response = await route.GET({ url: 'http://localhost/api/admin/limpeza/grupos' });
  assert.equal(response.status, 200);
  assert.equal(response.body, rows);
  assert.equal(released, true);
});
