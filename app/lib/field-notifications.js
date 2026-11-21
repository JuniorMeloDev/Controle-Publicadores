import { FIELD_MODES, fieldId, fieldMapUrl, usesSingleFieldLeader } from './field-service.js';

function mapLink(territory) {
  if (territory.mapa_share_token && territory.mapa_disponivel) {
    return `/mapa-territorio/${encodeURIComponent(territory.mapa_share_token)}`;
  }
  try { return fieldMapUrl(territory.mapa_url); } catch { return ''; }
}

function hasGroupTerritories(outing) {
  return usesSingleFieldLeader(outing) && outing.grupos.length > 0
    && (outing.grupos.length > 1 || Object.keys(outing.territorios_por_grupo || {}).length > 0);
}

export function fieldNotificationContent(outing, group, territories) {
  const selected = hasGroupTerritories(outing) ? outing.territorios_por_grupo?.[group?.id] || [] : outing.territorios;
  const assigned = selected.map(id => territories.get(id)).filter(Boolean);
  const numbers = assigned.map(t => t.numero);
  const groupName = group?.nome || 'Congregação';
  const work = outing.modalidade === 'territorio'
    ? `${numbers.length === 1 ? 'Território' : 'Territórios'} ${numbers.join(', ')}`
    : FIELD_MODES[outing.modalidade];
  return {
    title: `Serviço de Campo · ${groupName}`,
    detail: [work, outing.horario, outing.local, outing.dirigente && `Dirigente: ${outing.dirigente}`].filter(Boolean).join(' · '),
    links: assigned.flatMap(t => {
      const href = mapLink(t);
      return href ? [{ href, label: `Mapa do território ${t.numero}` }] : [];
    }),
  };
}

const fail = (message, status = 409) => Object.assign(new Error(message), { status });

// The caller holds the field-service lock and commits the send with its audit entry.
export async function sendFieldNotifications(client, outingId) {
  const id = fieldId(outingId);
  const { rows: [outing] } = await client.query(`SELECT s.*, s.data::text AS data, l.nome AS local,
      COALESCE(NULLIF(TRIM(p.nome_chamado), ''), p.nome_completo) AS dirigente
    FROM campo_saidas s LEFT JOIN campo_locais l ON l.id = s.local_id
    LEFT JOIN publicadores p ON p.id = s.dirigente_publicador_id WHERE s.id = $1`, [id]);
  if (!outing) throw fail('Saída não encontrada.', 404);
  const { rows: recipients } = await client.query(`SELECT p.id, p.grupo_id, g.nome_grupo AS nome
    FROM publicadores p LEFT JOIN grupos g ON g.id = p.grupo_id
    WHERE (g.id IS NULL OR COALESCE(g.ativo, TRUE))
      AND (cardinality($1::int[]) = 0 OR p.grupo_id = ANY($1::int[]))`, [outing.grupos]);
  if (!recipients.length) throw fail('Nenhum publicador foi encontrado para esta saída.');
  const { rows } = await client.query(`SELECT t.id, t.numero, t.mapa_url, t.mapa_share_token,
      t.ativo AND (t.limites IS NOT NULL OR EXISTS (
        SELECT 1 FROM campo_mapas m WHERE m.territorio_id = t.id
      )) AS mapa_disponivel
    FROM campo_territorios t WHERE t.id = ANY($1::int[])`, [outing.territorios]);
  const territories = new Map(rows.map(row => [row.id, row]));
  if (outing.modalidade === 'territorio' && !territories.size) throw fail('Escolha os territórios antes de enviar a notificação.');
  if (hasGroupTerritories(outing) && outing.grupos.some(groupId => !outing.territorios_por_grupo?.[groupId]?.some(id => territories.has(id)))) {
    throw fail('Defina os territórios de todos os grupos da saída antes de enviar a notificação.');
  }
  const payload = recipients.map(row => ({
    publicador_id: row.id,
    conteudo: fieldNotificationContent(outing, { id: row.grupo_id, nome: row.nome }, territories)
  }));
  await client.query(`DELETE FROM campo_saida_notificacoes WHERE saida_id = $1
    AND NOT (publicador_id = ANY($2::int[]))`, [id, recipients.map(row => row.id)]);
  const saved = await client.query(`INSERT INTO campo_saida_notificacoes (saida_id, publicador_id, data, conteudo)
    SELECT $1, r.publicador_id, $2, r.conteudo
    FROM jsonb_to_recordset($3::jsonb) AS r(publicador_id int, conteudo jsonb)
    ON CONFLICT (saida_id, publicador_id) DO UPDATE
    SET id = DEFAULT, data = EXCLUDED.data, conteudo = EXCLUDED.conteudo
    WHERE (campo_saida_notificacoes.data, campo_saida_notificacoes.conteudo)
      IS DISTINCT FROM (EXCLUDED.data, EXCLUDED.conteudo)
    RETURNING id::text AS id`, [id, outing.data, JSON.stringify(payload)]);
  return { id, ids: [id], destinatarios: recipients.length, notificacoes: saved.rowCount, pushIds: saved.rows.map(row => row.id) };
}

export async function readFieldNotifications(client, publisherId) {
  try {
    const { rows } = await client.query(`SELECT id, data::text AS date, conteudo FROM campo_saida_notificacoes
      WHERE publicador_id = $1 ORDER BY data DESC, id DESC`, [publisherId]);
    return rows.map(row => ({ ...row.conteudo, id: `campo-saida:${row.id}`, date: row.date, category: 'campo' }));
  } catch (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
}
