import { isCalendarDate } from './meeting-calendar';

export const canManageBoard = access => access?.isSuperAdmin === true ||
  (Array.isArray(access?.user?.privilegios) && access.user.privilegios.includes('anciao'));

export function validateBoardPost(body, { hasAttachment = false } = {}) {
  const text = key => typeof body[key] === 'string' ? body[key].trim() : '';
  const tipo = text('tipo');
  const titulo = text('titulo');
  const mensagem = text('mensagem');
  const inicio = text('inicio');
  const fim = text('fim');
  const data = text('data');
  const horario = text('horario');
  const local = text('local');
  const link = text('link');
  const grupo_id = body.grupo_id == null || body.grupo_id === '' ? null : Number(body.grupo_id);
  if (!['anuncio', 'saida', 'material'].includes(tipo)) throw new Error('Tipo de publicação inválido.');
  if (!titulo || titulo.length > 160 || !mensagem || mensagem.length > 5000) throw new Error('Informe título (até 160 caracteres) e mensagem (até 5.000 caracteres).');
  if (!isCalendarDate(inicio) || (fim && (!isCalendarDate(fim) || fim < inicio))) throw new Error('Período de publicação inválido.');
  if (tipo === 'saida' && (!isCalendarDate(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario) || !local)) throw new Error('Informe data, horário e local da saída de campo.');
  if (tipo === 'saida' && (data < inicio || (fim && data > fim))) throw new Error('A saída deve ocorrer dentro do período de publicação.');
  if (local.length > 250 || (grupo_id !== null && (!Number.isSafeInteger(grupo_id) || grupo_id <= 0))) throw new Error('Local ou grupo inválido.');
  if (tipo === 'material' && !link && !hasAttachment) throw new Error('Informe o link do material ou anexe um arquivo.');
  if (link) {
    let url;
    try { url = new URL(link); } catch { throw new Error('Informe um link válido.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || link.length > 2000) throw new Error('Informe um link HTTP ou HTTPS válido.');
  }
  return { tipo, titulo, mensagem, inicio, fim: fim || null, data: tipo === 'saida' ? data : null,
    horario: tipo === 'saida' ? horario : null, local: tipo === 'saida' ? local : null,
    link: link || null, grupo_id, fixado: body.fixado === true, confirmar_leitura: tipo === 'anuncio' && body.confirmar_leitura === true };
}
