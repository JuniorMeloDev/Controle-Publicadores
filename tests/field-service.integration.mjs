import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { saveFieldMap } from '../app/lib/field-map.js';
import { mutateFieldService, readFieldService } from '../app/lib/field-service-server.js';
import { generateFieldSchedule } from '../app/lib/field-planner.js';

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(73428191)');
  const publisher = (await client.query('SELECT id FROM publicadores ORDER BY id LIMIT 1')).rows[0];
  assert.ok(publisher, 'Precisa de um publicador para testar as referências.');
  const suffix = Date.now();
  const location = await mutateFieldService(client, { entity: 'locais', action: 'save', record: { nome: `TESTE CAMPO ${suffix}`, mapa_url: 'https://maps.google.com', grupos: [] } });
  const number = (await client.query('SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM campo_territorios')).rows[0].numero;
  const territory = await mutateFieldService(client, { entity: 'territorios', action: 'save', record: { numero: number, mapa_url: 'https://maps.app.goo.gl/teste', referencias: 'Quadra de teste' } });
  const record = { data: '2199-10-17', horario: '08:30', dirigente_publicador_id: publisher.id, local_id: location.id, grupos: [], territorios: [territory.id], modalidade: 'territorio', semanas: 3 };
  const outings = await mutateFieldService(client, { entity: 'saidas', action: 'save', record });
  assert.equal(outings.ids.length, 3);
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = $1', [territory.id])).rows[0].total, 0);
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'save', record }), /Já existe uma saída/);
  const handover = await mutateFieldService(client, { entity: 'designacoes', action: 'save', record: { territorio_id: territory.id, publicador_id: publisher.id, data_designacao: '2199-10-17' } });
  await assert.rejects(mutateFieldService(client, { entity: 'designacoes', action: 'save', record: { territorio_id: territory.id, publicador_id: publisher.id, data_designacao: '2199-10-18' } }), /já está designado/);
  await mutateFieldService(client, { entity: 'designacoes', action: 'complete', id: handover.id, data_conclusao: '2199-10-18' });
  const next = await mutateFieldService(client, { entity: 'designacoes', action: 'save', record: { territorio_id: territory.id, publicador_id: publisher.id, data_designacao: '2199-10-19' } });
  assert.ok(next.id);
  await mutateFieldService(client, { entity: 'saidas', action: 'delete', id: outings.id });
  const snapshot = await readFieldService(client);
  assert.equal(snapshot.saidas.filter(row => outings.ids.includes(row.id)).length, 2);
  assert.equal(snapshot.designacoes.filter(row => row.territorio_id === territory.id).length, 2);
  assert.equal(snapshot.territorios.find(row => row.id === territory.id).ultima_conclusao, '2199-10-18');
  assert.equal(snapshot.territorios.find(row => row.id === territory.id).mapa_url, 'https://maps.app.goo.gl/teste');
  assert.equal(snapshot.territorios.find(row => row.id === territory.id).referencias, 'Quadra de teste');
  assert.ok(snapshot.saidas.filter(row => outings.ids.includes(row.id)).every(row => row.dirigente_publicador_id === publisher.id));
  assert.ok(snapshot.publicadores.every(row => Object.keys(row).sort().join(',') === 'id,nome'));
  // Legacy leader IDs differ from publisher IDs. Verify backfill and repeated migration.
  await client.query('INSERT INTO campo_dirigentes (publicador_id) VALUES ($1) ON CONFLICT (publicador_id) DO NOTHING', [publisher.id]);
  const legacyLeader = (await client.query('SELECT id FROM campo_dirigentes WHERE publicador_id = $1', [publisher.id])).rows[0];
  const legacy = (await client.query(`INSERT INTO campo_saidas (data, horario, dirigente_id, modalidade)
    VALUES ('2199-11-30', '21:45', $1, 'cartas') RETURNING id`, [legacyLeader.id])).rows[0];
  const migration = (await readFile(new URL('../scripts/sql/adicionar-servico-campo.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  await client.query(migration);
  assert.equal((await client.query('SELECT dirigente_publicador_id FROM campo_saidas WHERE id = $1', [legacy.id])).rows[0].dirigente_publicador_id, publisher.id);
  await mutateFieldService(client, { entity: 'saidas', action: 'save', record: { id: legacy.id, data: '2199-11-30', horario: '21:45', modalidade: 'cartas', dirigente_publicador_id: null } });
  await client.query(migration);
  const cleared = (await client.query('SELECT dirigente_publicador_id, dirigente_id FROM campo_saidas WHERE id = $1', [legacy.id])).rows[0];
  assert.equal(cleared.dirigente_publicador_id, null);
  assert.equal(cleared.dirigente_id, null);
  const map = { name: 'mapa-teste.pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') };
  await saveFieldMap(client, null, map);
  await saveFieldMap(client, territory.id, map);
  await saveFieldMap(client, territory.id, { ...map, name: 'mapa-atualizado.pdf' });
  const withMaps = await readFieldService(client);
  assert.equal(withMaps.mapas.find(item => item.territorio_id === territory.id).nome, 'mapa-atualizado.pdf');
  assert.ok(withMaps.mapas.some(item => item.chave === 'geral'));
  assert.ok(withMaps.mapas.every(item => !Object.hasOwn(item, 'conteudo')));
  assert.deepEqual((await client.query('SELECT conteudo FROM campo_mapas WHERE territorio_id = $1', [territory.id])).rows[0].conteudo, map.buffer);
  const batchTerritories = [];
  for (let index = 1; index <= 6; index++) {
    batchTerritories.push((await mutateFieldService(client, { entity: 'territorios', action: 'save', record: { numero: number + index, periodo: 'ambos' } })).id);
  }
  const batchOuting = await mutateFieldService(client, { entity: 'saidas', action: 'save', registrar_entrega: true, record: {
    data: '2198-11-03', horario: '04:13', modalidade: 'territorio', territorios: batchTerritories.slice(0, 4), dirigente_publicador_id: publisher.id
  } });
  const concluded = await mutateFieldService(client, { entity: 'saidas', action: 'result', id: batchOuting.id, data: '2198-11-03', resultados: batchTerritories.slice(0, 4).map(territorio_id => ({ territorio_id, resultado: 'concluido' })) });
  assert.equal(concluded.resultados, 4);
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = ANY($1::int[]) AND data_conclusao = $2', [batchTerritories, '2198-11-03'])).rows[0].total, 4);
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'result', id: batchOuting.id, data: '2198-11-03', resultados: [{ territorio_id: batchTerritories[0], resultado: 'concluido' }] }), /já tem resultado/);
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'save', record: { id: batchOuting.id, data: '2198-11-04', horario: '04:13', modalidade: 'territorio', territorios: batchTerritories.slice(0, 4), dirigente_publicador_id: publisher.id } }), /já tem resultados/);
  const mixed = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: { data: '2198-11-04', horario: '04:13', modalidade: 'territorio', territorios: batchTerritories.slice(4), dirigente_publicador_id: publisher.id } });
  await mutateFieldService(client, { entity: 'saidas', action: 'result', id: mixed.id, data: '2198-11-04', resultados: [
    { territorio_id: batchTerritories[4], resultado: 'parcial', observacoes: 'Falta a quadra 2.' },
    { territorio_id: batchTerritories[5], resultado: 'nao_trabalhado' }
  ] });
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = $1 AND data_conclusao IS NULL', [batchTerritories[4]])).rows[0].total, 1);
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = $1', [batchTerritories[5]])).rows[0].total, 0);
  const historic = { territorio_id: batchTerritories[0], responsavel_nome: 'Responsável antigo', data_designacao: '2198-09-01', data_conclusao: '2198-09-30' };
  assert.equal((await mutateFieldService(client, { entity: 'designacoes', action: 'import', records: [historic] })).importados, 1);
  assert.equal((await mutateFieldService(client, { entity: 'designacoes', action: 'import', records: [historic] })).ignorados, 1);
  const state = await readFieldService(client);
  const generated = generateFieldSchedule({ ...state, territorios: state.territorios.filter(t => batchTerritories.includes(t.id)) }, {
    inicio: '2198-12-01', fim: '2198-12-01', intervalo: 14, regras: [{ dia: new Date('2198-12-01T12:00:00Z').getUTCDay(), horario: '04:13', quantidade: 4 }]
  });
  assert.equal(generated.rows[0].territorios.length, 4);
  const saved = await mutateFieldService(client, { entity: 'saidas', action: 'batch', records: generated.rows });
  assert.equal(saved.ids.length, 1);
  // A later conflict must roll back earlier inserts in the same batch.
  await client.query('SAVEPOINT batch_atomicity');
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'batch', intervalo: 1, records: [
    { ...generated.rows[0], data: '2198-12-10' },
    { ...generated.rows[0], data: '2198-12-10', territorios: [batchTerritories[5]] }
  ] }), /Já existe uma saída/);
  await client.query('ROLLBACK TO SAVEPOINT batch_atomicity');
  assert.equal((await client.query("SELECT COUNT(*)::int AS total FROM campo_saidas WHERE data = '2198-12-10' AND horario = '04:13'")).rows[0].total, 0);
  await mutateFieldService(client, { entity: 'saidas', action: 'delete', id: batchOuting.id });
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_saida_resultados WHERE id = ANY($1::int[]) AND saida_id IS NULL', [concluded.ids])).rows[0].total, 4);
  // New migration is repeatable, including old weekend preferences.
  const planningMigration = (await readFile(new URL('../scripts/sql/adicionar-planejamento-campo.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  await client.query(planningMigration);
  await client.query(planningMigration);
  console.log('Planejamento aprovado: quatro conclusões, resultados parciais, importação sem duplicidade, geração em lote e rollback.');
  console.log('Integração aprovada: seleção direta, recorrência, conflitos, histórico e migração dos dirigentes existentes.');
} catch (error) {
  console.error('Falha na integração:', error.code || error.message);
  process.exitCode = 1;
} finally {
  if (client) { await client.query('ROLLBACK'); client.release(); }
  await pool.end();
  console.log('Todos os registros desta verificação foram revertidos.');
}
