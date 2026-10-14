export function phoneContactLinks(value) {
  if (typeof value !== 'string' || !/^[+\d\s().-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (!value.trim().startsWith('+') && [10, 11].includes(digits.length)) digits = '55' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return { phone: `tel:+${digits}`, whatsapp: `https://wa.me/${digits}` };
}

export function validateGroupLeadership(body) {
  if ([body.grupo_id, body.superintendente_id, body.ajudante_id].some(value => value != null && !['number', 'string'].includes(typeof value))) throw new Error('Grupo ou responsável inválido.');
  const id = value => value === '' || value == null ? null : Number(value);
  const groupId = Number(body.grupo_id);
  const superintendentId = id(body.superintendente_id);
  const assistantId = id(body.ajudante_id);
  if (!Number.isSafeInteger(groupId) || groupId <= 0 || [superintendentId, assistantId].some(value => value !== null && (!Number.isSafeInteger(value) || value <= 0))) throw new Error('Grupo ou responsável inválido.');
  if (superintendentId && superintendentId === assistantId) throw new Error('Superintendente e ajudante devem ser pessoas diferentes.');
  return { groupId, superintendentId, assistantId };
}
