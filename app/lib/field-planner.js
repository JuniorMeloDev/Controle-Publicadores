import { fieldDate, fieldId, validateFieldRecord, isTerritoryAllowedForOuting } from './field-service.js';
import { formatDateBR } from './date-format.js';

export const TERRITORY_PERIODS = { semana: 'Durante a semana', fim_semana: 'Fim de semana', ambos: 'Ambos' };
export const FIELD_RESULTS = { concluido: 'Concluído', parcial: 'Parcial', nao_trabalhado: 'Não trabalhado' };

export function territoryPeriod(territory) {
  return territory.periodo || (territory.fim_semana ? 'fim_semana' : 'ambos');
}

// One deterministic pass. Draft reservations count as usage; pending handovers
// remain unavailable until their conclusion is recorded.
export function generateFieldSchedule(snapshot, config) {
  const start = fieldDate(config.inicio), end = fieldDate(config.fim);
  if (end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 92) throw new Error('Escolha um período de até 93 dias.');
  if (!Array.isArray(config.regras) || !config.regras.length || config.regras.length > 21) throw new Error('Adicione entre 1 e 21 horários de saída.');
  const rules = config.regras.map(rule => {
    const day = Number(rule.dia), count = Number(rule.quantidade);
    if (!Number.isInteger(day) || day < 0 || day > 6 || !Number.isInteger(count) || count < 1 || count > 100) throw new Error('Confira o dia da semana e a quantidade de territórios.');
    return { ...validateFieldRecord('saidas', { ...rule, data: start, modalidade: 'territorio' }), dia: day, quantidade: count };
  });
  const interval = Number(config.intervalo ?? 14);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) throw new Error('O intervalo deve ser de 1 a 365 dias.');
  const periods = config.periodos || {};
  const blocked = new Set(snapshot.designacoes.filter(d => !d.data_conclusao).map(d => d.territorio_id));
  const territories = snapshot.territorios.filter(t => t.ativo && !blocked.has(t.id));
  const planned = [...snapshot.saidas];
  const rows = [], warnings = [];
  for (const cursor = new Date(`${start}T12:00:00Z`); cursor.toISOString().slice(0, 10) <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10), weekend = [0, 6].includes(cursor.getUTCDay());
    for (const rule of rules.filter(r => r.dia === cursor.getUTCDay())) {
      if (planned.some(s => s.data === date && s.horario === rule.horario && (!s.grupos.length || !rule.grupos.length || rule.grupos.some(g => s.grupos.includes(g))))) {
        warnings.push(`${formatDateBR(date)} ${rule.horario}: já existe uma saída para esses grupos.`); continue;
      }
      const usage = id => planned.filter(s => s.territorios.includes(id)).map(s => s.data);
      const candidates = territories.filter(t => {
        if (!isTerritoryAllowedForOuting(t, { data: date, modalidade: 'territorio', grupos: rule.grupos })) return false;
        const period = periods[t.id] || territoryPeriod(t);
        if (!Object.hasOwn(TERRITORY_PERIODS, period)) throw new Error('Período de território inválido.');
        if ((period === 'semana' && weekend) || (period === 'fim_semana' && !weekend)) return false;
        return ![...(t.ultima_conclusao ? [t.ultima_conclusao] : []), ...usage(t.id)].some(d => Math.abs(Date.parse(d) - Date.parse(date)) / 86400000 < interval);
      }).sort((a, b) => {
        const last = t => [...(t.ultima_conclusao ? [t.ultima_conclusao] : []), ...usage(t.id).filter(d => d <= date)].sort().at(-1) || '';
        return last(a).localeCompare(last(b)) || a.numero - b.numero;
      });
      const record = { data: date, horario: rule.horario, modalidade: 'territorio', local_id: rule.local_id,
        grupos: rule.grupos, territorios: candidates.slice(0, rule.quantidade).map(t => t.id), dirigente_publicador_id: null, observacoes: '' };
      if (record.territorios.length < rule.quantidade) warnings.push(`${formatDateBR(date)} ${rule.horario}: ${record.territorios.length} de ${rule.quantidade} territórios disponíveis.`);
      rows.push(record); planned.push(record);
      if (rows.length > 200) throw new Error('Gere no máximo 200 saídas por vez.');
    }
  }
  if (!rows.length) throw new Error('Nenhuma saída disponível nesse período. Confira os dias e os conflitos.');
  return { rows, warnings };
}

export function validateImportedHistory(input) {
  const data_designacao = fieldDate(input.data_designacao);
  const data_conclusao = fieldDate(input.data_conclusao);
  if (data_conclusao < data_designacao) throw new Error('A conclusão não pode ser anterior à entrega.');
  const responsavel_nome = typeof input.responsavel_nome === 'string' ? input.responsavel_nome.trim() : '';
  const observacoes = typeof input.observacoes === 'string' ? input.observacoes.trim() : '';
  if (responsavel_nome.length > 200 || observacoes.length > 2000) throw new Error('Texto muito longo.');
  return { territorio_id: fieldId(input.territorio_id), publicador_id: fieldId(input.publicador_id, true), responsavel_nome, data_designacao, data_conclusao, observacoes };
}
