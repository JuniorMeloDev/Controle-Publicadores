// Show distinct work dates, ordered by completion rather than handover.
export function recentTerritoryWork(data, territoryId, asOf) {
  const names = new Map(data.publicadores.map(person => [person.id, person.nome]));
  const dates = new Map();
  for (const row of data.designacoes) {
    if (row.territorio_id !== Number(territoryId) || !row.data_conclusao || (asOf && row.data_conclusao > asOf)) continue;
    const responsible = row.responsavel_nome || names.get(row.publicador_id) || 'Responsável não informado';
    if (!dates.has(row.data_conclusao)) dates.set(row.data_conclusao, new Set());
    dates.get(row.data_conclusao).add(responsible);
  }
  return [...dates].sort(([a], [b]) => b.localeCompare(a)).slice(0, 3).map(([date, people]) => ({ date, names: [...people].join(', ') }));
}
