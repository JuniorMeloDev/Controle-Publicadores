export const FIELD_MODES = { territorio: 'Território', cartas: 'Cartas', revisitas: 'Revisitas e estudos' };

export function fieldMapUrl(value) {
  const result = text(value, 1000);
  if (!result) return '';
  let url;
  try { url = new URL(result); } catch { throw new Error('Informe um link válido para o mapa.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('O mapa deve usar um link HTTP ou HTTPS.');
  return result;
}

export function fieldId(value, optional = false) {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0 || Number(value) > 2147483647) throw new Error('Seleção inválida.');
  return Number(value);
}

export function fieldDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200) throw new Error('Informe uma data válida.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Informe uma data válida.');
  return value;
}

function text(value, max = 2000, required = false) {
  if (value !== undefined && typeof value !== 'string') throw new Error('Texto inválido.');
  const result = (value || '').trim();
  if (result.length > max || (required && !result)) throw new Error(required ? 'Preencha os campos obrigatórios.' : 'Texto muito longo.');
  return result;
}
function ids(value = []) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Lista de seleções inválida.');
  return [...new Set(value.map(id => fieldId(id)))];
}
function active(value) {
  if (value !== undefined && typeof value !== 'boolean') throw new Error('Status inválido.');
  return value !== false;
}
export function fieldServiceYear(date) { return Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) >= 9 ? 1 : 0); }
export function weeklyDates(date, count = 1) {
  fieldDate(date);
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('Escolha entre 1 e 12 semanas.');
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + index * 7);
    return fieldDate(next.toISOString().slice(0, 10));
  });
}
export function validateFieldRecord(entity, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dados inválidos.');
  const id = fieldId(input.id, true);
  if (entity === 'locais') {
    const mapa_url = text(input.mapa_url, 1000);
    if (mapa_url) {
      let url;
      try { url = new URL(mapa_url); } catch { throw new Error('Informe um link válido para o mapa.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('O mapa deve usar um link HTTP ou HTTPS.');
    }
    return { id, nome: text(input.nome, 120, true), endereco: text(input.endereco), mapa_url, grupos: ids(input.grupos), observacoes: text(input.observacoes), ativo: active(input.ativo) };
  }
  if (entity === 'territorios') return { id, numero: fieldId(input.numero), descricao: text(input.descricao), mapa_url: fieldMapUrl(input.mapa_url), referencias: text(input.referencias), fim_semana: input.fim_semana === true, ativo: active(input.ativo) };
  if (entity === 'saidas') {
    const data = fieldDate(input.data);
    const horario = text(input.horario, 40, true);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario) && horario !== 'Pós reunião') throw new Error('Informe um horário válido ou selecione Pós reunião.');
    if (!Object.hasOwn(FIELD_MODES, input.modalidade)) throw new Error('Modalidade inválida.');
    return { id, data, horario, dirigente_publicador_id: fieldId(input.dirigente_publicador_id, true), dirigente_id: null, local_id: fieldId(input.local_id, true), grupos: ids(input.grupos), territorios: input.modalidade === 'territorio' ? ids(input.territorios) : [], modalidade: input.modalidade, observacoes: text(input.observacoes), semanas: id ? 1 : Number(input.semanas ?? 1) };
  }
  if (entity === 'designacoes') {
    const data_designacao = fieldDate(input.data_designacao);
    const data_conclusao = input.data_conclusao ? fieldDate(input.data_conclusao) : null;
    if (data_conclusao && data_conclusao < data_designacao) throw new Error('A conclusão não pode ser anterior à designação.');
    return { id, territorio_id: fieldId(input.territorio_id), publicador_id: fieldId(input.publicador_id), data_designacao, data_conclusao, observacoes: text(input.observacoes) };
  }
  throw new Error('Cadastro inválido.');
}
