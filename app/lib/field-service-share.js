import { FIELD_MODES, fieldMapUrl, usesSingleFieldLeader, assignmentContinuationNotes } from './field-service.js';

const safeUrl = value => { try { return fieldMapUrl(value); } catch { return ''; } };
export const fieldWhatsAppUrl = message => `https://api.whatsapp.com/send/?text=${encodeURIComponent(message)}`;
export function buildTerritoryMessage(territory, publicMapUrl = '') {
  return [
    `\u{1F9ED} *TERRITÓRIO ${territory.numero}*`,
    territory.descricao ? `_${territory.descricao}_` : '',
    territory.referencias ? `\u{1F4CC} Referências e orientações: ${territory.referencias}` : '',
    publicMapUrl ? `\u{1F5FA}\u{FE0F} *MAPA DO TERRITÓRIO:*\n${publicMapUrl}` : '',
    safeUrl(territory.mapa_url) ? `\u{1F4CD} *ENDEREÇO DO TERRITÓRIO (GOOGLE MAPS):*\n${safeUrl(territory.mapa_url)}` : ''
  ].filter(Boolean).join('\n');
}
export function buildFieldOutingMessage(outing, data, publicMapUrls = {}) {
  const location = data.locais.find(row => row.id === outing.local_id);
  const leader = data.publicadores.find(row => row.id === outing.dirigente_publicador_id);
  const groups = outing.grupos.map(id => data.grupos.find(row => row.id === id)?.nome || 'Grupo removido');
  const territories = outing.modalidade === 'territorio'
    ? outing.territorios.map(id => data.territorios.find(row => row.id === id)).filter(Boolean)
    : [];
  const lines = [
    '\u{1F33F} *SERVIÇO DE CAMPO*',
    `\u{1F4C5} *Data:* ${outing.data.slice(0, 10).split('-').reverse().join('/')}`,
    `\u{1F552} *Horário:* ${outing.horario}`,
    `\u{1F464} *Dirigente:* ${leader?.nome || 'A definir'}`,
    `\u{1F465} *Grupos:* ${groups.length ? groups.join(', ') : 'Congregação'}`,
    '',
    '\u{1F4CD} *LOCAL DA CONSIDERAÇÃO*',
    `*${location?.nome || 'A definir'}*`
  ];
  if (location?.endereco) lines.push(location.endereco);
  if (safeUrl(location?.mapa_url)) lines.push(`Google Maps da consideração: ${safeUrl(location.mapa_url)}`);
  lines.push('', `\u{1F4CB} *Modalidade:* ${FIELD_MODES[outing.modalidade] || outing.modalidade}`);
  const territoryMessage = territory => {
    const message = buildTerritoryMessage(territory, publicMapUrls[territory.id] || '');
    const current = (data.designacoes || []).find(d => d.territorio_id === territory.id && !d.data_conclusao && !d.data_transferencia);
    const notes = current ? assignmentContinuationNotes(current, data.resultados) : '';
    return notes ? `${message}\n*CONTINUAÇÃO — O QUE FALTA TRABALHAR:*\n${notes}` : message;
  };
  if (usesSingleFieldLeader(outing) && outing.grupos.length) {
    const remaining = new Map(territories.map(territory => [territory.id, territory]));
    outing.grupos.forEach((groupId, index) => {
      const assigned = [];
      for (const id of outing.territorios_por_grupo?.[groupId] || []) {
        const territory = remaining.get(id);
        if (!territory) continue;
        assigned.push(territoryMessage(territory));
        remaining.delete(id);
      }
      lines.push('', `*${groups[index]}*`, assigned.length ? assigned.join('\n\n') : 'Territórios a definir');
    });
    if (remaining.size) lines.push('', '*Sem grupo na saída*', [...remaining.values()].map(territoryMessage).join('\n\n'));
  } else {
    for (const territory of territories) lines.push('', territoryMessage(territory));
  }
  if (outing.observacoes) lines.push('', `\u{1F4E3} *ORIENTAÇÕES DA SAÍDA*\n${outing.observacoes}`);
  return lines.join('\n');
}
