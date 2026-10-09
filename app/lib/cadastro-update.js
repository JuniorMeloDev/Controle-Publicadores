import { normalizeEmergencyContacts, emergencyContactsValue } from './emergency-contacts';
export const CADASTRO_FIELDS = [
  ['nome_completo', 'Nome completo'], ['nome_chamado', 'Nome chamado (apelido)'],
  ['data_nascimento', 'Nascimento', 'date'], ['data_batismo', 'Batismo', 'date'],
  ['sexo', 'Sexo'], ['telefone', 'Telefone'], ['email', 'E-mail', 'email'],
  ['cep', 'CEP'], ['logradouro', 'Endereço'], ['numero', 'Número'],
  ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'Estado'],
  ['contatos_emergencia', 'Contatos de emergência', 'contacts'],
];
export const CADASTRO_LIMITS = { nome_completo: 255, nome_chamado: 100, data_nascimento: 10, data_batismo: 10, sexo: 20, telefone: 20, email: 254, cep: 10, logradouro: 255, numero: 20, complemento: 100, bairro: 100, cidade: 100, estado: 2 };
export function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
export function normalizeDate(value) {
  if (!value) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Data inválida.');
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== iso || Number(iso.slice(0, 4)) < 1900 || iso > new Date().toISOString().slice(0, 10)) throw new Error('Data inválida.');
  return iso;
}
export function personalData(row) {
  return Object.fromEntries(CADASTRO_FIELDS.map(([key, , type]) => [key, type === 'contacts' ? row[key] || [] : type === 'date' ? normalizeDate(row[key]) : String(row[key] ?? '').trim()]));
}
export function validatePersonalData(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dados inválidos.');
  const result = {};
  for (const [key, label, type] of CADASTRO_FIELDS) {
    if (type === 'contacts') { result[key] = normalizeEmergencyContacts(input[key]); continue; }
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error(`${label}: valor inválido.`);
    let value = (input[key] || '').trim();
    if (value.length > CADASTRO_LIMITS[key]) throw new Error(`${label}: texto muito longo.`);
    if (type === 'date') value = normalizeDate(value);
    if (type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('E-mail inválido.');
    if (key === 'sexo' && value && !['Masculino', 'Feminino'].includes(value)) throw new Error('Sexo inválido.');
    if (key === 'estado' && value) {
      value = value.toUpperCase();
      if (!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(value)) throw new Error('Estado inválido. Use a sigla UF.');
    }
    result[key] = value;
  }
  return result;
}
export function planChanges(current, incoming, snapshot) {
  const automatic = [], pending = [];
  for (const [field] of CADASTRO_FIELDS) {
    const contacts = field === 'contatos_emergencia';
    const value = contacts ? emergencyContactsValue(incoming[field]) : incoming[field];
    const before = contacts ? emergencyContactsValue(snapshot[field]) : snapshot[field];
    const now = contacts ? emergencyContactsValue(current[field]) : current[field];
    if (!value || value === before || value === now) continue;
    (now ? pending : automatic).push({ field, old: now, value });
  }
  return { automatic, pending };
}
