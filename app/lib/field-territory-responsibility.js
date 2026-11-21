import { usesSingleFieldLeader } from './field-service.js';

export function fieldTerritoryGroup(outing, territoryId) {
  if (!usesSingleFieldLeader(outing)) return null;
  const group = Object.entries(outing.territorios_por_grupo || {}).find(([, ids]) => ids.includes(territoryId));
  return group ? Number(group[0]) : null;
}

export async function fieldTerritoryResponsible(client, outing, territoryId) {
  const groupId = fieldTerritoryGroup(outing, territoryId);
  if (groupId === null) return outing.dirigente_publicador_id;

  const { rows: [group] } = await client.query(`SELECT g.nome_grupo,
      CASE WHEN p.grupo_id = g.id THEN p.id ELSE g.superintendente_id END AS publicador_id
    FROM grupos g JOIN publicadores p ON p.id = $2
    WHERE g.id = $1 FOR SHARE OF g, p`, [groupId, outing.dirigente_publicador_id]);
  if (!group?.publicador_id) {
    throw Object.assign(new Error(`Defina o superintendente do grupo ${group?.nome_grupo || groupId} antes de registrar o território.`), { status: 409 });
  }
  return group.publicador_id;
}
