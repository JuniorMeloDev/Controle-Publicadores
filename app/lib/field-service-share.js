import { FIELD_MODES, fieldMapUrl } from './field-service.js';

const safeUrl = value => { try { return fieldMapUrl(value); } catch { return ''; } };
export const fieldWhatsAppUrl = message => `https://api.whatsapp.com/send/?text=${encodeURIComponent(message)}`;
export function buildTerritoryMessage(territory) {
  return [ `Território ${territory.numero}`, territory.descricao || '',
    territory.referencias ? `Referências e orientações: ${territory.referencias}` : '',
    safeUrl(territory.mapa_url) ? `Google Maps do território: ${safeUrl(territory.mapa_url)}` : ''
  ].filter(Boolean).join('\n');
}
export function buildFieldOutingMessage(outing, data) {
  const location = data.locais.find(row => row.id === outing.local_id);
  const leader = data.publicadores.find(row => row.id === outing.dirigente_publicador_id);
  const groups = outing.grupos.map(id => data.grupos.find(row => row.id === id)?.nome || 'Grupo removido');
  const lines = ['Serviço de Campo', `Data: ${outing.data.slice(0, 10).split('-').reverse().join('/')} · Horário: ${outing.horario}`,
    `Dirigente: ${leader?.nome || 'A definir'}`, `Grupos: ${groups.length ? groups.join(', ') : 'Congregação'}`,
    `Local da consideração: ${location?.nome || 'A definir'}`];
  if (location?.endereco) lines.push(`Endereço da consideração: ${location.endereco}`);
  if (safeUrl(location?.mapa_url)) lines.push(`Google Maps da consideração: ${safeUrl(location.mapa_url)}`);
  lines.push(`Modalidade: ${FIELD_MODES[outing.modalidade] || outing.modalidade}`);
  if (outing.modalidade === 'territorio') for (const id of outing.territorios) {
    const territory = data.territorios.find(row => row.id === id);
    if (territory) lines.push('', buildTerritoryMessage(territory));
  }
  if (outing.observacoes) lines.push('', `Orientações da saída: ${outing.observacoes}`);
  return lines.join('\n');
}
