export const MAX_EMERGENCY_CONTACTS = 10;
export function normalizeEmergencyContacts(input) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > MAX_EMERGENCY_CONTACTS) throw new Error('Informe até 10 contatos de emergência.');
  return input.flatMap(contact => {
    if (!contact || typeof contact !== 'object' || typeof contact.nome !== 'string' || typeof contact.telefone !== 'string') throw new Error('Contato de emergência inválido.');
    const nome = contact.nome.trim(), telefone = contact.telefone.trim();
    if (!nome && !telefone) return [];
    if (nome.length < 2 || nome.length > 100) throw new Error('Informe o nome do contato de emergência (até 100 caracteres).');
    if (telefone.length > 30 || !/^[+\d\s().-]+$/.test(telefone) || telefone.replace(/\D/g, '').length < 8 || telefone.replace(/\D/g, '').length > 15) throw new Error('Informe um telefone válido para cada contato de emergência.');
    return [{ nome, telefone }];
  });
}
export function emergencyContactsValue(value) {
  const contacts = typeof value === 'string' ? JSON.parse(value || '[]') : value || [];
  return contacts.length ? JSON.stringify(contacts.map(({ nome, telefone }) => ({ nome, telefone }))) : '';
}
export function formatEmergencyContacts(value) {
  try {
    const contacts = typeof value === 'string' ? JSON.parse(value || '[]') : value || [];
    return contacts.map(contact => `${contact.nome}: ${contact.telefone}`).join('; ') || 'Vazio';
  } catch { return String(value || 'Vazio'); }
}
