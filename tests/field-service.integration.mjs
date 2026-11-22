import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { saveFieldMap } from '../app/lib/field-map.js';
import { mutateFieldService, readFieldService } from '../app/lib/field-service-server.js';
import { generateFieldSchedule } from '../app/lib/field-planner.js';
import { readTerritoryProgress, saveTerritoryProgress } from '../app/lib/territory-progress-server.js';
import { isFieldOutingCompleted } from '../app/lib/field-service.js';
import { readFieldOutingBlocks } from '../app/lib/field-service-batch.js';

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(73428191)');
  const singleLeaderMigration = (await readFile(new URL('../scripts/sql/adicionar-dirigente-unico-campo.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  await client.query(singleLeaderMigration);
  await client.query(singleLeaderMigration);
  const transferMigration = (await readFile(new URL('../scripts/sql/adicionar-transferencias-campo.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  await client.query(transferMigration);
  await client.query(transferMigration);
  const blocksMigration = (await readFile(new URL('../scripts/sql/adicionar-progresso-quadras.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  await client.query(blocksMigration);
  await client.query(blocksMigration);
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
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = ANY($1::int[]) AND data_conclusao = $2', [batchTerritories, '2198-11-03'])).rows[0].total, 4);
  await mutateFieldService(client, { entity: 'saidas', action: 'delete', id: mixed.id });
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = $1 AND data_conclusao IS NULL', [batchTerritories[4]])).rows[0].total, 1);

  const cancelRecord = { data: '2198-11-05', horario: '04:13', modalidade: 'territorio', territorios: [batchTerritories[5]], dirigente_publicador_id: publisher.id };
  const cancelled = await mutateFieldService(client, { entity: 'saidas', action: 'save', registrar_entrega: true, record: cancelRecord });
  const cancellation = await mutateFieldService(client, { entity: 'saidas', action: 'delete', id: cancelled.id });
  assert.equal(cancellation.entregas_anteriores_removidas.length, 1);
  assert.equal((await client.query('SELECT COUNT(*)::int AS total FROM campo_designacoes WHERE territorio_id = $1', [batchTerritories[5]])).rows[0].total, 0);
  // Reproduces an orphan left by the old deletion path, then repairs it twice.
  const orphan = await mutateFieldService(client, { entity: 'saidas', action: 'save', registrar_entrega: true, record: cancelRecord });
  await client.query('DELETE FROM campo_saidas WHERE id = $1', [orphan.id]);
  const cleanupMigration = (await readFile(new URL('../scripts/sql/corrigir-entregas-saidas-excluidas.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  const beforeCleanup = await readFieldService(client);
  await client.query(cleanupMigration);
  const afterCleanup = await readFieldService(client);
  const removed = beforeCleanup.designacoes.filter(d => !afterCleanup.designacoes.some(row => row.id === d.id));
  assert.ok(removed.some(d => d.observacoes === `Entrega registrada pela saída ${orphan.id}.`));
  assert.ok(removed.every(d => !d.data_conclusao && !beforeCleanup.resultados.some(r => r.designacao_id === d.id)));
  assert.ok(afterCleanup.designacoes.some(d => d.territorio_id === batchTerritories[4] && !d.data_conclusao));
  assert.equal(afterCleanup.designacoes.filter(d => batchTerritories.slice(0, 4).includes(d.territorio_id) && d.data_conclusao === '2198-11-03').length, 4);
  const cleanupAudit = (await client.query("SELECT details FROM auditoria_logs WHERE action = 'campo_entregas_orfas_corrigidas' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.ok(cleanupAudit.details.entregas_anteriores_removidas.some(d => d.observacoes === `Entrega registrada pela saída ${orphan.id}.`));
  await client.query(cleanupMigration);
  assert.deepEqual((await readFieldService(client)).designacoes, afterCleanup.designacoes);
  // New migration is repeatable, including old weekend preferences.
  const planningMigration = (await readFile(new URL('../scripts/sql/adicionar-planejamento-campo.sql', import.meta.url), 'utf8')).replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
  await client.query(planningMigration);
  await client.query(planningMigration);
  // Shared consideration is saved ahead of time, then territories are assigned
  // independently to each group on that outing without changing map ownership.
  const groups = (await client.query('SELECT id FROM grupos WHERE COALESCE(ativo, TRUE) ORDER BY id LIMIT 2')).rows.map(g => g.id);
  assert.equal(groups.length, 2, 'Precisa de dois grupos ativos para testar o dirigente único.');
  const secondPublisher = (await client.query('SELECT id FROM publicadores WHERE id <> $1 ORDER BY id LIMIT 1', [publisher.id])).rows[0];
  assert.ok(secondPublisher, 'Precisa de dois publicadores para testar a responsabilidade e a transferência.');
  await client.query('UPDATE publicadores SET grupo_id = $2 WHERE id = $1', [publisher.id, groups[0]]);
  await client.query('UPDATE grupos SET superintendente_id = $2 WHERE id = $1', [groups[1], secondPublisher.id]);
  const groupTerritories = [];
  for (const offset of [7, 8]) groupTerritories.push((await mutateFieldService(client, { entity: 'territorios', action: 'save', record: { numero: number + offset } })).id);
  const weekend = new Date('2199-12-01T12:00:00Z');
  weekend.setUTCDate(weekend.getUTCDate() + (6 - weekend.getUTCDay() + 7) % 7);
  const sharedRecord = { data: weekend.toISOString().slice(0, 10), horario: '04:19', modalidade: 'territorio', grupos: groups,
    territorios: [], dirigente_publicador_id: publisher.id };
  const shared = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: sharedRecord });
  const pendingShared = (await readFieldService(client)).saidas.find(s => s.id === shared.id);
  assert.equal(pendingShared.dirigente_unico, true);
  assert.deepEqual(pendingShared.territorios_por_grupo, {});
  const mapping = { [groups[0]]: [groupTerritories[0]], [groups[1]]: [groupTerritories[1]] };
  await mutateFieldService(client, { entity: 'saidas', action: 'save', record: { ...pendingShared, territorios_por_grupo: mapping } });
  const savedShared = (await readFieldService(client)).saidas.find(s => s.id === shared.id);
  assert.deepEqual(savedShared.territorios_por_grupo, mapping);
  assert.deepEqual(savedShared.territorios, groupTerritories);
  assert.equal(savedShared.dirigente_publicador_id, publisher.id);
  assert.ok((await readFieldService(client)).territorios.filter(t => groupTerritories.includes(t.id)).every(t => t.mapa_grupo_id === null));
  await mutateFieldService(client, { entity: 'saidas', action: 'result', id: shared.id, data: sharedRecord.data,
    resultados: groupTerritories.map(territorio_id => ({ territorio_id, resultado: 'concluido' })) });
  const sharedDeliveries = (await readFieldService(client)).designacoes;
  assert.deepEqual(groupTerritories.map(id => sharedDeliveries.find(d => d.territorio_id === id)?.publicador_id),
    [publisher.id, secondPublisher.id]);
  const nextWeekend = new Date(weekend);
  nextWeekend.setUTCDate(nextWeekend.getUTCDate() + 7);
  const sharedHandover = await mutateFieldService(client, { entity: 'saidas', action: 'save', registrar_entrega: true, record: {
    ...sharedRecord, data: nextWeekend.toISOString().slice(0, 10), territorios_por_grupo: mapping
  } });
  const handoverRows = (await readFieldService(client)).designacoes.filter(d => d.observacoes === `Entrega registrada pela saída ${sharedHandover.id}.`);
  assert.deepEqual(groupTerritories.map(id => handoverRows.find(d => d.territorio_id === id)?.publicador_id),
    [publisher.id, secondPublisher.id]);
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'save', record: { ...savedShared,
    territorios_por_grupo: { [groups[0]]: [groupTerritories[1]], [groups[1]]: [groupTerritories[0]] } } }), /já tem resultados/);
  const separate = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: { ...sharedRecord, data: '2199-12-20', dirigente_unico: false } });
  assert.equal((await readFieldService(client)).saidas.find(s => s.id === separate.id).dirigente_unico, false);
  console.log('Dirigente único aprovado: padrão marcado, territórios por grupo definidos depois, JSONB persistido e resultados preservados.');
  const continuationTerritory = await mutateFieldService(client, { entity: 'territorios', action: 'save', record: { numero: number + 9 } });
  const continuationDate = weeks => {
    const date = new Date(weekend);
    date.setUTCDate(date.getUTCDate() + weeks * 7);
    return date.toISOString().slice(0, 10);
  };
  const firstOuting = await mutateFieldService(client, { entity: 'saidas', action: 'save', registrar_entrega: true, record: {
    data: continuationDate(4), horario: '04:23', modalidade: 'territorio', territorios: [continuationTerritory.id], dirigente_publicador_id: publisher.id
  } });
  await mutateFieldService(client, { entity: 'saidas', action: 'result', id: firstOuting.id, data: continuationDate(4),
    resultados: [{ territorio_id: continuationTerritory.id, resultado: 'parcial', observacoes: 'Faltam as quadras 3 e 4.' }] });
  const originalDelivery = (await readFieldService(client)).designacoes.find(d => d.territorio_id === continuationTerritory.id);
  const nextRecord = { data: continuationDate(5), horario: '04:23', modalidade: 'territorio', territorios: [continuationTerritory.id], dirigente_publicador_id: secondPublisher.id };
  const nextOuting = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: nextRecord });
  assert.equal((await readFieldService(client)).designacoes.filter(d => d.territorio_id === continuationTerritory.id).length, 1);
  const transferred = await mutateFieldService(client, { entity: 'saidas', action: 'save', registrar_entrega: true,
    transferencias: { [continuationTerritory.id]: originalDelivery.id }, record: { ...nextRecord, id: nextOuting.id } });
  assert.equal(transferred.transferencias.length, 1);
  let continuationState = await readFieldService(client);
  const secondDelivery = continuationState.designacoes.find(d => d.designacao_anterior_id === originalDelivery.id);
  assert.equal(secondDelivery.orientacoes_continuacao, 'Faltam as quadras 3 e 4.');
  assert.equal(secondDelivery.publicador_id, secondPublisher.id);
  assert.equal(continuationState.designacoes.find(d => d.id === originalDelivery.id).data_transferencia, continuationDate(5));
  assert.equal(continuationState.designacoes.find(d => d.id === originalDelivery.id).data_conclusao, null);
  assert.equal(continuationState.territorios.find(t => t.id === continuationTerritory.id).ultima_conclusao, null);
  assert.equal(continuationState.resultados.find(r => r.designacao_id === originalDelivery.id).observacoes, 'Faltam as quadras 3 e 4.');
  await assert.rejects(mutateFieldService(client, { entity: 'designacoes', action: 'complete', id: originalDelivery.id, data_conclusao: continuationDate(5) }), /transferida/);
  await assert.rejects(mutateFieldService(client, { entity: 'designacoes', action: 'transfer', id: originalDelivery.id, publicador_id: publisher.id, data_transferencia: continuationDate(6) }), /transferida/);
  // A failure while creating the next responsibility must restore the old one.
  await client.query('SAVEPOINT failed_transfer');
  await assert.rejects(mutateFieldService(client, { entity: 'designacoes', action: 'transfer', id: secondDelivery.id,
    publicador_id: 2147483647, data_transferencia: continuationDate(6) }));
  await client.query('ROLLBACK TO SAVEPOINT failed_transfer');
  assert.equal((await readFieldService(client)).designacoes.find(d => d.id === secondDelivery.id).data_transferencia, null);
  await mutateFieldService(client, { entity: 'saidas', action: 'result', id: nextOuting.id, data: continuationDate(5),
    resultados: [{ territorio_id: continuationTerritory.id, resultado: 'parcial', observacoes: 'Agora falta apenas a quadra 4.' }] });
  const third = await mutateFieldService(client, { entity: 'designacoes', action: 'transfer', id: secondDelivery.id,
    publicador_id: publisher.id, data_transferencia: continuationDate(6), observacoes: 'Continuação na semana seguinte.' });
  assert.equal(third.transferencia.orientacoes_continuacao, 'Agora falta apenas a quadra 4.');
  await mutateFieldService(client, { entity: 'designacoes', action: 'complete', id: third.id, data_conclusao: continuationDate(6) });
  continuationState = await readFieldService(client);
  const chain = continuationState.designacoes.filter(d => d.territorio_id === continuationTerritory.id);
  assert.equal(chain.length, 3);
  assert.equal(chain.filter(d => d.data_conclusao).length, 1);
  assert.equal(continuationState.territorios.find(t => t.id === continuationTerritory.id).ultima_conclusao, continuationDate(6));
  await mutateFieldService(client, { entity: 'saidas', action: 'delete', id: firstOuting.id });
  await mutateFieldService(client, { entity: 'saidas', action: 'delete', id: nextOuting.id });
  await client.query(cleanupMigration);
  assert.equal((await readFieldService(client)).designacoes.filter(d => d.territorio_id === continuationTerritory.id).length, 3);
  console.log('Transferências aprovadas: três responsáveis, parciais preservados, rollback, exclusão segura e apenas uma conclusão real.');
  const resultTransferTerritory = await mutateFieldService(client, { entity: 'territorios', action: 'save', record: { numero: number + 10 } });
  const resultTransferOld = await mutateFieldService(client, { entity: 'designacoes', action: 'save', record: {
    territorio_id: resultTransferTerritory.id, publicador_id: publisher.id, data_designacao: continuationDate(7), observacoes: 'Falta a rua de trás.'
  } });
  const resultTransferOuting = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: {
    data: continuationDate(8), horario: '04:24', modalidade: 'territorio', territorios: [resultTransferTerritory.id], dirigente_publicador_id: secondPublisher.id
  } });
  await assert.rejects(mutateFieldService(client, { entity: 'saidas', action: 'result', id: resultTransferOuting.id, data: continuationDate(8),
    resultados: [{ territorio_id: resultTransferTerritory.id, resultado: 'concluido' }] }), /já está designado/);
  const resultTransfer = await mutateFieldService(client, { entity: 'saidas', action: 'result', id: resultTransferOuting.id, data: continuationDate(8),
    resultados: [{ territorio_id: resultTransferTerritory.id, resultado: 'concluido', transferir_de: resultTransferOld.id }] });
  assert.equal(resultTransfer.transferencias.length, 1);
  const resultTransferState = await readFieldService(client);
  const resultTransferNew = resultTransferState.designacoes.find(d => d.designacao_anterior_id === resultTransferOld.id);
  assert.equal(resultTransferNew.data_conclusao, continuationDate(8));
  assert.equal(resultTransferNew.orientacoes_continuacao, 'Falta a rua de trás.');
  assert.equal(resultTransferState.designacoes.find(d => d.id === resultTransferOld.id).data_conclusao, null);
  const progressDelivery = await mutateFieldService(client, { entity: 'territorios', action: 'save', record: { numero: number + 11 } });
  const progressTerritory = { id: progressDelivery.id, mapa_layout: {
    outline: [[100, 100], [400, 100], [400, 400], [100, 400]],
    roads: [{ points: [[250, 100], [250, 400]] }, { points: [[100, 250], [400, 250]] }],
    landmarks: [
      { id: 'osm-point-one', name: 'Referência 1', position: [350, 175] },
      { id: 'osm-point-two', name: 'Referência 2', position: [350, 325] },
    ],
  }};
  const firstDate = '2199-12-17', nextDate = '2199-12-18', newCycleDate = '2199-12-19';
  await client.query('UPDATE campo_territorios SET mapa_layout = $2 WHERE id = $1',
    [progressTerritory.id, JSON.stringify(progressTerritory.mapa_layout)]);
  const leader = { id: publisher.id, privilegios: [] };
  const ordinaryPublisher = { id: secondPublisher.id, privilegios: [] };
  const progressOuting = { horario: '04:35', modalidade: 'territorio', territorios: [progressTerritory.id] };
  const firstProgressOuting = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: {
    ...progressOuting, data: firstDate, dirigente_publicador_id: leader.id,
  } });
  const initial = await readTerritoryProgress(client, progressTerritory, leader, firstDate);
  assert.equal(initial.state.canEdit, true);
  assert.equal(initial.state.blocks.length, 4);
  const completed = initial.state.blocks.filter(block => block.referenceNumbers.length).map(block => block.id);
  assert.equal(completed.length, 2);
  const firstMarked = completed.slice(0, 1);
  const save = { action: 'save', completed: firstMarked, version: initial.state.version };
  for (const viewer of [null, ordinaryPublisher]) {
    const context = await readTerritoryProgress(client, progressTerritory, viewer, firstDate);
    await assert.rejects(saveTerritoryProgress(client, progressTerritory, viewer, save, context), { status: 403 });
  }
  const progress = await saveTerritoryProgress(client, progressTerritory, leader, save, initial);
  const savedProgress = await readTerritoryProgress(client, progressTerritory, leader, firstDate);
  assert.deepEqual(savedProgress.state.completed, firstMarked);
  assert.equal(savedProgress.state.completedOn, null);
  await assert.rejects(saveTerritoryProgress(client, progressTerritory, leader, save, savedProgress), { status: 409 });
  const blockOptions = (await readFieldOutingBlocks(client, firstProgressOuting.id))[progressTerritory.id];
  assert.deepEqual(blockOptions.completed, firstMarked);
  assert.deepEqual(blockOptions.layout, progressTerritory.mapa_layout);
  assert.deepEqual(blockOptions.blocks, initial.state.blocks);
  const partialResult = { entity: 'saidas', action: 'result', id: firstProgressOuting.id, data: firstDate, resultados: [{
    territorio_id: progressTerritory.id, resultado: 'parcial', quadras_concluidas: completed, quadras_anteriores: firstMarked,
  }] };
  await assert.rejects(mutateFieldService(client, { ...partialResult,
    resultados: [{ ...partialResult.resultados[0], quadras_anteriores: [] }],
  }), { status: 409 });
  const partialSaved = await mutateFieldService(client, partialResult);
  const { rows: [partialRecord] } = await client.query('SELECT observacoes FROM campo_saida_resultados WHERE id = $1', [partialSaved.ids[0]]);
  const pendingNumbers = initial.state.blocks.flatMap((block, index) => completed.includes(block.id) ? [] : [index + 1]);
  assert.equal(partialRecord.observacoes, `Quadras pendentes: ${pendingNumbers.join(', ')}.`);
  assert.deepEqual((await readTerritoryProgress(client, progressTerritory, leader, firstDate)).state.completed, completed);
  await mutateFieldService(client, { entity: 'designacoes', action: 'transfer', id: progress.id,
    publicador_id: ordinaryPublisher.id, data_transferencia: nextDate });
  const nextProgressOuting = await mutateFieldService(client, { entity: 'saidas', action: 'save', record: {
    ...progressOuting, data: nextDate, dirigente_publicador_id: ordinaryPublisher.id,
  } });
  const continued = await readTerritoryProgress(client, progressTerritory, ordinaryPublisher, nextDate);
  assert.deepEqual(continued.state.completed, completed);
  assert.equal(continued.state.canEdit, true);
  assert.equal((await readTerritoryProgress(client, progressTerritory, leader, nextDate)).state.canEdit, false);
  for (const role of ['anciao', 'servo_ministerial']) {
    assert.equal((await readTerritoryProgress(client, progressTerritory, { ...leader, privilegios: [role] }, nextDate)).state.canEdit, true);
  }
  const mapConclusion = await saveTerritoryProgress(client, progressTerritory, ordinaryPublisher, {
    action: 'complete', version: continued.state.version,
  }, continued);
  const after = await readTerritoryProgress(client, progressTerritory, null, nextDate);
  assert.equal(after.state.completedOn, nextDate);
  assert.equal(after.state.completed.length, 4);
  const progressSnapshot = await readFieldService(client);
  assert.equal(progressSnapshot.designacoes.find(row => row.id === mapConclusion.id).data_conclusao, nextDate);
  assert.equal(isFieldOutingCompleted(progressSnapshot.saidas.find(row => row.id === nextProgressOuting.id),
    progressSnapshot.designacoes, progressSnapshot.resultados), true);
  await mutateFieldService(client, { entity: 'saidas', action: 'save', record: {
    ...progressOuting, data: newCycleDate, dirigente_publicador_id: leader.id,
  } });
  const newCycle = await readTerritoryProgress(client, progressTerritory, leader, newCycleDate);
  assert.equal(newCycle.state.canEdit, true);
  assert.deepEqual(newCycle.state.completed, []);
  console.log('Quadras verificadas: acesso restrito, marcação parcial, transferência, conclusão no Histórico e novo ciclo.');
  console.log('Planejamento aprovado: quatro conclusões, resultados parciais, importação sem duplicidade, geração em lote e rollback.');
  console.log('Integração aprovada: seleção direta, recorrência, conflitos, histórico e migração dos dirigentes existentes.');
} catch (error) {
  console.error('Falha na integração:', error.code || error.message, error.detail || '');
  process.exitCode = 1;
} finally {
  if (client) { await client.query('ROLLBACK'); client.release(); }
  await pool.end();
  console.log('Todos os registros desta verificação foram revertidos.');
}
