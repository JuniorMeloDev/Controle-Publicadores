import { fieldDate, fieldId, validateFieldRecord } from './field-service.js';
import { FIELD_RESULTS, TERRITORY_PERIODS, validateImportedHistory } from './field-planner.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const list = (value, max) => {
  if (!Array.isArray(value) || !value.length || value.length > max) throw fail(`Selecione entre 1 e ${max} registros.`);
  return value;
};

export async function mutateFieldBatch(client, body, mutate) {
  await client.query('SELECT pg_advisory_xact_lock(73428191)');
  if (body.entity === 'saidas' && body.action === 'batch') {
    const rows = list(body.records, 200).map(row => {
      const validated = validateFieldRecord('saidas', row);
      if (validated.id || validated.semanas !== 1) throw fail('A programação em lote deve conter apenas novas saídas individuais.');
      return validated;
    });
    const periods = Object.entries(body.periodos || {});
    if (periods.length > 1000) throw fail('Muitos territórios.');
    for (const [key, period] of periods) {
      const id = fieldId(key);
      if (!Object.hasOwn(TERRITORY_PERIODS, period)) throw fail('Período de território inválido.');
      const result = await client.query('UPDATE campo_territorios SET periodo = $2, fim_semana = $3 WHERE id = $1 AND ativo RETURNING id', [id, period, period === 'fim_semana']);
      if (!result.rows.length) throw fail('Um território foi desativado ou removido. Gere novamente.', 409);
    }
    // Recheck availability after the preview, inside the same transaction.
    const selected = [...new Set(rows.flatMap(row => row.territorios))];
    const interval = Number(body.intervalo ?? 14);
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) throw fail('Intervalo de programação inválido.');
    const pending = await client.query('SELECT id FROM campo_designacoes WHERE territorio_id = ANY($1::int[]) AND data_conclusao IS NULL', [selected]);
    if (pending.rows.length) throw fail('Um território ficou pendente após a prévia. Gere a programação novamente.', 409);
    const territories = (await client.query('SELECT id, periodo FROM campo_territorios WHERE id = ANY($1::int[]) AND ativo', [selected])).rows;
    const latest = (await client.query('SELECT territorio_id, MAX(data_conclusao)::text AS data FROM campo_designacoes WHERE territorio_id = ANY($1::int[]) GROUP BY territorio_id', [selected])).rows;
    const planned = (await client.query('SELECT data::text AS data, territorios FROM campo_saidas WHERE territorios && $1::int[]', [selected])).rows;
    for (const row of rows) {
      if (!row.territorios.length) throw fail('Remova as saídas sem territórios ou gere novamente.');
      const weekend = [0, 6].includes(new Date(`${row.data}T12:00:00Z`).getUTCDay());
      for (const id of row.territorios) {
        const territory = territories.find(t => t.id === id);
        if (!territory || (territory.periodo === 'semana' && weekend) || (territory.periodo === 'fim_semana' && !weekend)) throw fail('Um território não está disponível para o dia escolhido. Gere novamente.', 409);
        const uses = [...latest.filter(d => d.territorio_id === id && d.data), ...planned.filter(s => s.territorios.includes(id))];
        if (uses.some(use => Math.abs(Date.parse(use.data) - Date.parse(row.data)) / 86400000 < interval)) throw fail('O histórico ou a agenda mudou após a prévia. Confira o intervalo e gere novamente.', 409);
      }
      planned.push(row);
    }
    const ids = [];
    for (const record of rows) ids.push((await mutate(client, { entity: 'saidas', action: 'save', record })).id);
    return { id: ids[0], ids };
  }
  if (body.entity === 'designacoes' && body.action === 'import') {
    const rows = list(body.records, 500).map(validateImportedHistory);
    const ids = [];
    let skipped = 0;
    for (const row of rows) {
      const territory = await client.query('SELECT id FROM campo_territorios WHERE id = $1 FOR SHARE', [row.territorio_id]);
      if (!territory.rows.length) throw fail('Território não encontrado. Confira a importação.');
      if (row.publicador_id && !(await client.query('SELECT id FROM publicadores WHERE id = $1 FOR SHARE', [row.publicador_id])).rows.length) throw fail('Responsável não encontrado.');
      const duplicate = await client.query(`SELECT id FROM campo_designacoes WHERE territorio_id = $1 AND data_designacao = $2 AND data_conclusao = $3`, [row.territorio_id, row.data_designacao, row.data_conclusao]);
      if (duplicate.rows.length) { skipped++; continue; }
      const overlap = await client.query(`SELECT id FROM campo_designacoes WHERE territorio_id = $1
        AND (data_conclusao IS NULL OR data_conclusao > $2::date) AND data_designacao < $3::date`, [row.territorio_id, row.data_designacao, row.data_conclusao]);
      if (overlap.rows.length) throw fail('O histórico importado se sobrepõe a uma designação existente. Confira as datas.', 409);
      ids.push((await client.query(`INSERT INTO campo_designacoes
        (territorio_id, publicador_id, responsavel_nome, data_designacao, data_conclusao, observacoes, origem_importacao)
        VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id`, [row.territorio_id, row.publicador_id, row.responsavel_nome, row.data_designacao, row.data_conclusao, row.observacoes])).rows[0].id);
    }
    return { id: ids[0] || null, ids, ignorados: skipped, importados: ids.length };
  }
  if (body.entity !== 'saidas' || body.action !== 'result') throw fail('Ação inválida.');
  const id = fieldId(body.id), date = fieldDate(body.data);
  const outing = (await client.query('SELECT *, data::text AS data FROM campo_saidas WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!outing) throw fail('Saída não encontrada.', 404);
  if (outing.modalidade !== 'territorio' || !outing.dirigente_publicador_id) throw fail('Escolha o dirigente antes de registrar o resultado.');
  if (date < outing.data) throw fail('O resultado não pode ser anterior à saída.');
  const results = list(body.resultados, 100);
  const seen = new Set(), ids = [];
  for (const input of results) {
    const territoryId = fieldId(input.territorio_id);
    if (!outing.territorios.includes(territoryId) || seen.has(territoryId) || !Object.hasOwn(FIELD_RESULTS, input.resultado)) throw fail('Confira os territórios e seus resultados.');
    seen.add(territoryId);
    const notes = typeof input.observacoes === 'string' ? input.observacoes.trim() : '';
    if (notes.length > 2000 || (input.resultado === 'parcial' && !notes)) throw fail('No resultado parcial, informe o que falta trabalhar (até 2000 caracteres).');
    const previous = (await client.query('SELECT * FROM campo_saida_resultados WHERE saida_id = $1 AND territorio_id = $2', [id, territoryId])).rows[0];
    if (previous) throw fail('Este território já tem resultado nesta saída. Atualize a lista.', 409);
    let delivery = null;
    if (input.resultado !== 'nao_trabalhado') {
      const marker = `Entrega registrada pela saída ${id}.`;
      delivery = (await client.query(`SELECT *, data_designacao::text AS data_designacao, data_conclusao::text AS data_conclusao
        FROM campo_designacoes WHERE territorio_id = $1 AND observacoes = $2 FOR UPDATE`, [territoryId, marker])).rows[0];
      if (delivery?.data_conclusao && (input.resultado !== 'concluido' || delivery.data_conclusao !== date)) throw fail('A conclusão deste território já foi registrada em outra data.', 409);
      if (!delivery) {
        const created = await mutate(client, { entity: 'designacoes', action: 'save', record: {
          territorio_id: territoryId, publicador_id: outing.dirigente_publicador_id, data_designacao: outing.data,
          data_conclusao: input.resultado === 'concluido' ? date : null, observacoes: marker
        } });
        delivery = { id: created.id, data_designacao: outing.data, data_conclusao: input.resultado === 'concluido' ? date : null };
      }
      if (date < delivery.data_designacao) throw fail('O resultado não pode ser anterior à entrega.');
      if (input.resultado === 'concluido' && !delivery.data_conclusao) await mutate(client, { entity: 'designacoes', action: 'complete', id: delivery.id, data_conclusao: date });
    }
    ids.push((await client.query(`INSERT INTO campo_saida_resultados (saida_id, territorio_id, designacao_id, resultado, data, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [id, territoryId, delivery?.id || null, input.resultado, date, notes])).rows[0].id);
  }
  return { id, ids, resultados: ids.length };
}
