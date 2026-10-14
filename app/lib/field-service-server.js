import { fieldId, fieldDate, validateFieldRecord, weeklyDates } from './field-service.js';

const tables = { locais: 'campo_locais', territorios: 'campo_territorios', saidas: 'campo_saidas', designacoes: 'campo_designacoes' };
export function fieldError(message, status = 400) { return Object.assign(new Error(message), { status }); }

export async function readFieldService(client) {
  const result = {};
  // Use one client sequentially; return only the names needed by the selectors.
  result.publicadores = (await client.query(`SELECT id, COALESCE(NULLIF(TRIM(nome_chamado), ''), nome_completo) AS nome
    FROM publicadores ORDER BY nome, id`)).rows;
  result.grupos = (await client.query('SELECT id, nome_grupo AS nome, COALESCE(ativo, TRUE) AS ativo FROM grupos ORDER BY nome_grupo')).rows;
  result.locais = (await client.query('SELECT * FROM campo_locais ORDER BY nome, id')).rows;
  result.territorios = (await client.query(`SELECT t.*, (SELECT MAX(d.data_conclusao)::text FROM campo_designacoes d WHERE d.territorio_id = t.id) AS ultima_conclusao
    FROM campo_territorios t ORDER BY numero`)).rows;
  result.saidas = (await client.query('SELECT s.*, s.data::text AS data FROM campo_saidas s ORDER BY s.data, s.horario, s.id')).rows;
  result.designacoes = (await client.query(`SELECT d.*, d.data_designacao::text AS data_designacao, d.data_conclusao::text AS data_conclusao
    FROM campo_designacoes d ORDER BY d.data_designacao DESC, d.id DESC`)).rows;
  result.mapas = (await client.query('SELECT chave, territorio_id, nome, tamanho, atualizado_em FROM campo_mapas ORDER BY chave')).rows;
  return result;
}

async function reference(client, table, selected, previous, needsActive = true) {
  if (!selected.length) return;
  const result = await client.query(`SELECT id${needsActive ? ', ativo' : ''} FROM ${table} WHERE id = ANY($1::int[]) FOR SHARE`, [selected]);
  if (selected.some(id => !result.rows.some(row => row.id === id && (!needsActive || row.ativo !== false || previous.includes(id))))) throw fieldError('Uma seleção foi removida ou desativada. Atualize a lista e tente novamente.');
}

export async function mutateFieldService(client, body) {
  if (!body || !Object.hasOwn(tables, body.entity)) throw fieldError('Cadastro inválido.');
  const table = tables[body.entity];
  if (!['save', 'delete', 'complete'].includes(body.action)) throw fieldError('Ação inválida.');
  // Serializes writes, including recurring batches and checks for concurrent assignments.
  await client.query('SELECT pg_advisory_xact_lock(73428191)');
  if (body.action === 'delete' || body.action === 'complete') {
    const id = fieldId(body.id);
    if (body.action === 'delete') {
      if (body.entity !== 'saidas') throw fieldError('Desative o cadastro para preservar o histórico.');
      const deleted = await client.query('DELETE FROM campo_saidas WHERE id = $1 RETURNING id', [id]);
      if (!deleted.rows.length) throw fieldError('Saída não encontrada.', 404);
      return { id, ids: [id] };
    }
    if (body.entity !== 'designacoes') throw fieldError('Registro inválido.');
    const record = (await client.query('SELECT *, data_designacao::text AS data_designacao FROM campo_designacoes WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!record) throw fieldError('Designação não encontrada.', 404);
    if (record.data_conclusao) throw fieldError('Esta designação já foi concluída.', 409);
    const date = fieldDate(body.data_conclusao);
    if (date < record.data_designacao) throw fieldError('A conclusão não pode ser anterior à designação.');
    await client.query('UPDATE campo_designacoes SET data_conclusao = $2 WHERE id = $1', [id, date]);
    return { id, ids: [id] };
  }
  const record = validateFieldRecord(body.entity, body.record);
  let old = {};
  if (record.id) {
    old = (await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [record.id])).rows[0];
    if (!old) throw fieldError('Registro não encontrado.', 404);
  }
  if (record.grupos) await reference(client, 'grupos', record.grupos, old.grupos || []);
  if (record.local_id) await reference(client, 'campo_locais', [record.local_id], [old.local_id]);
  if (record.publicador_id) await reference(client, 'publicadores', [record.publicador_id], [], false);
  if (record.dirigente_publicador_id) await reference(client, 'publicadores', [record.dirigente_publicador_id], [], false);
  if (record.territorios) await reference(client, 'campo_territorios', record.territorios, old.territorios || []);
  if (record.territorio_id) await reference(client, 'campo_territorios', [record.territorio_id], [old.territorio_id]);
  if (body.entity === 'designacoes') {
    // History is append-only. Corrections require a separately audited workflow.
    if (record.id) throw fieldError('Use Registrar conclusão para atualizar uma designação.');
    const overlap = await client.query(`SELECT id FROM campo_designacoes WHERE territorio_id = $1
      AND (data_conclusao IS NULL OR data_conclusao > $2::date)
      AND ($3::date IS NULL OR data_designacao < $3::date)`, [record.territorio_id, record.data_designacao, record.data_conclusao]);
    if (overlap.rows.length) throw fieldError('Este território já está designado nesse período. Registre a conclusão antes de designá-lo novamente.', 409);
  }
  const dates = body.entity === 'saidas' ? weeklyDates(record.data, record.semanas) : [null];
  const created = [];
  for (const date of dates) {
    if (date) {
      record.data = date;
      const conflicts = await client.query(`SELECT id FROM campo_saidas WHERE data = $1 AND horario = $2 AND id <> COALESCE($3, 0)
        AND (($4::int IS NOT NULL AND dirigente_publicador_id = $4) OR cardinality(grupos) = 0 OR cardinality($5::int[]) = 0 OR grupos && $5::int[])`,
      [date, record.horario, record.id, record.dirigente_publicador_id, record.grupos]);
      if (conflicts.rows.length) throw fieldError(`Já existe uma saída para o dirigente ou os grupos em ${date.split('-').reverse().join('/')} às ${record.horario}.`, 409);
    }
    const columns = Object.keys(record).filter(key => !['id', 'semanas'].includes(key));
    const values = columns.map(key => record[key]);
    let sql;
    if (record.id) {
      values.push(record.id);
      sql = `UPDATE ${table} SET ${columns.map((key, index) => `${key} = $${index + 1}`).join(', ')} WHERE id = $${values.length} RETURNING id`;
    } else sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING id`;
    created.push((await client.query(sql, values)).rows[0].id);
  }
  return { id: created[0], ids: created };
}
