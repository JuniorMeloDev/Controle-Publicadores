import { fieldDate, fieldId } from './field-service.js';

const fail = (message, status = 409) => Object.assign(new Error(message), { status });

// Called under the field-service advisory lock and the API transaction.
export async function transferFieldAssignment(client, input, mutate) {
  const id = fieldId(input.id), publisherId = fieldId(input.publicador_id);
  const date = fieldDate(input.data_transferencia);
  const previous = (await client.query(`SELECT *, data_designacao::text AS data_designacao
    FROM campo_designacoes WHERE id = $1 FOR UPDATE`, [id])).rows[0];
  if (!previous) throw fail('Entrega não encontrada.', 404);
  if (previous.data_conclusao || previous.data_transferencia) throw fail('Esta entrega já foi concluída ou transferida. Atualize a lista.');
  if (input.territorio_id && fieldId(input.territorio_id) !== previous.territorio_id) throw fail('A pendência pertence a outro território.');
  if (date < previous.data_designacao) throw fail('A transferência não pode ser anterior à entrega.', 400);
  const latest = (await client.query(`SELECT data::text AS data, resultado, observacoes FROM campo_saida_resultados
    WHERE designacao_id = $1 ORDER BY data DESC, id DESC LIMIT 1`, [id])).rows[0];
  if (latest && date < latest.data) throw fail('A transferência não pode ser anterior ao último resultado registrado.', 400);
  const notes = latest?.observacoes || previous.orientacoes_continuacao
    || (!/^Entrega registrada pela saída \d+\.$/.test(previous.observacoes || '') ? previous.observacoes : '') || '';
  await client.query('UPDATE campo_designacoes SET data_transferencia = $2 WHERE id = $1', [id, date]);
  const next = await mutate(client, { entity: 'designacoes', action: 'save', record: {
    territorio_id: previous.territorio_id, publicador_id: publisherId, data_designacao: date,
    observacoes: input.observacoes || ''
  } });
  await client.query(`UPDATE campo_designacoes SET designacao_anterior_id = $2, orientacoes_continuacao = $3,
    quadras_concluidas = (SELECT quadras_concluidas FROM campo_designacoes WHERE id = $2) WHERE id = $1`, [next.id, id, notes]);
  return { ...next, transferencia: { designacao_anterior_id: id, designacao_id: next.id,
    territorio_id: previous.territorio_id, responsavel_anterior_id: previous.publicador_id,
    publicador_id: publisherId, data: date, orientacoes_continuacao: notes } };
}
