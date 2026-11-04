import { FIELD_MODES, fieldMapUrl } from './field-service.js';

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
  const previewMapUrl = territories.map(territory => publicMapUrls[territory.id]).find(Boolean)
    || territories.map(territory => safeUrl(territory.mapa_url)).find(Boolean);
  const lines = [
    ...(previewMapUrl ? [previewMapUrl, ''] : []),
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
  for (const territory of territories) lines.push('', buildTerritoryMessage(territory, publicMapUrls[territory.id] || ''));
  if (outing.observacoes) lines.push('', `\u{1F4E3} *ORIENTAÇÕES DA SAÍDA*\n${outing.observacoes}`);
  return lines.join('\n');
}
