import { createHash } from 'node:crypto';
import { todayInBrazil } from './alerts.js';
import { mutateFieldService } from './field-service-server.js';
import { fieldTerritoryResponsible } from './field-territory-responsibility.js';
import { territoryBlocks } from './territory-blocks.js';

const fail = (message, status) => Object.assign(new Error(message), { status });
const deliveryMarker = id => `Entrega registrada pela saída ${id}.`;

export async function readTerritoryProgress(client, territory, user, today = todayInBrazil()) {
  const assignment = (await client.query(`SELECT id, observacoes, quadras_concluidas,
    data_designacao::text, data_conclusao::text, data_transferencia::text
    FROM campo_designacoes WHERE territorio_id = $1
    ORDER BY (data_conclusao IS NULL AND data_transferencia IS NULL) DESC, data_designacao DESC, id DESC LIMIT 1`, [territory.id])).rows[0];
  const open = assignment && !assignment.data_conclusao && !assignment.data_transferencia ? assignment : null;
  const outings = (await client.query(`SELECT s.*, s.data::text, r.designacao_id, r.resultado
    FROM campo_saidas s LEFT JOIN campo_saida_resultados r ON r.saida_id = s.id AND r.territorio_id = $1
    WHERE s.data = $2 AND s.modalidade = 'territorio' AND $1 = ANY(s.territorios)
      AND s.dirigente_publicador_id IS NOT NULL
    ORDER BY s.id`, [territory.id, today])).rows;
  const available = outings.filter(row => row.resultado !== 'concluido'
    && (!row.designacao_id || row.designacao_id === open?.id));
  const led = available.filter(row => row.dirigente_publicador_id === user?.id);
  const outing = available.find(row => open && (row.designacao_id === open.id || open.observacoes === deliveryMarker(row.id)))
    || (available.length === 1 ? available[0] : led.length === 1 ? led[0] : null);
  const privileged = Array.isArray(user?.privilegios)
    && user.privilegios.some(role => role === 'anciao' || role === 'servo_ministerial');
  const newDelivery = !open && outing && assignment?.data_conclusao !== today
    && assignment?.observacoes !== deliveryMarker(outing.id);
  const current = open && open.data_designacao <= today ? open : null;
  const canEdit = Boolean(user && (privileged || outing?.dirigente_publicador_id === user.id) && (current || newDelivery));
  const blocks = territoryBlocks(territory.mapa_layout);
  const completedOn = newDelivery ? null : assignment?.data_conclusao || null;
  const blockIds = blocks.map(block => block.id);
  const checked = newDelivery ? [] : assignment?.quadras_concluidas || [];
  const completed = completedOn ? blockIds : blockIds.filter(id => checked.includes(id));
  const drawingVersion = `${territory.mapa_revisao}:${territory.mapa_layout_revisao}`;
  const version = canEdit ? createHash('sha256').update(JSON.stringify([
    territory.id, drawingVersion, today, current?.id, outing?.id, blockIds, checked,
  ])).digest('hex') : null;
  return { current, outing, today, state: { blocks, completed, completedOn, canEdit, signedIn: Boolean(user), version, drawingVersion } };
}

export async function saveTerritoryProgress(client, territory, user, body, context, mutate = mutateFieldService) {
  const { current, outing, today, state } = context;
  if (!user || !state.canEdit) throw fail('A edição é reservada ao dirigente da saída de hoje, aos anciãos e aos servos ministeriais com uma entrega ou saída disponível.', 403);
  if (body?.version !== state.version) throw fail('O mapa ou a designação mudou. Confira o progresso atualizado antes de salvar.', 409);
  const blockIds = state.blocks.map(block => block.id);
  const conclude = body.action === 'complete';
  if (!conclude && (body.action !== 'save' || !Array.isArray(body.completed)
    || body.completed.length > blockIds.length || body.completed.some(id => !blockIds.includes(id))
    || new Set(body.completed).size !== body.completed.length)) {
    throw fail('Confira as quadras selecionadas.', 400);
  }
  const completed = conclude ? blockIds : blockIds.filter(id => body.completed.includes(id));
  if (!conclude && completed.length === state.completed.length && completed.every(id => state.completed.includes(id))) {
    return { id: current?.id, changed: false, completed };
  }
  const delivery = current || await mutate(client, { entity: 'designacoes', action: 'save', record: {
    territorio_id: territory.id, publicador_id: await fieldTerritoryResponsible(client, outing, territory.id),
    data_designacao: outing.data, observacoes: deliveryMarker(outing.id),
  } });
  await client.query('UPDATE campo_designacoes SET quadras_concluidas = $2 WHERE id = $1', [delivery.id, completed]);
  if (conclude) {
    await mutate(client, { entity: 'designacoes', action: 'complete', id: delivery.id, data_conclusao: today });
    if (outing) await client.query(`INSERT INTO campo_saida_resultados (saida_id, territorio_id, designacao_id, resultado, data)
      VALUES ($1, $2, $3, 'concluido', $4)
      ON CONFLICT (saida_id, territorio_id) DO UPDATE SET designacao_id = EXCLUDED.designacao_id
      WHERE campo_saida_resultados.designacao_id IS NULL`, [outing.id, territory.id, delivery.id, today]);
  }
  return { id: delivery.id, changed: true, completed };
}
