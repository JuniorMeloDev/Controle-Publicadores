import { emergencyContactsValue } from './emergency-contacts';
let columnReady = false;
export async function ensureEmergencyContactsColumn(client) {
  if (columnReady) return;
  await client.query(`ALTER TABLE publicadores ADD COLUMN IF NOT EXISTS contatos_emergencia JSONB NOT NULL DEFAULT '[]'::jsonb`);
  columnReady = true;
}
export async function saveEmergencyContacts(client, id, previous, contacts) {
  const oldValue = emergencyContactsValue(previous), newValue = emergencyContactsValue(contacts);
  if (oldValue === newValue) return;
  await client.query('UPDATE publicadores SET contatos_emergencia = $1::jsonb WHERE id = $2', [JSON.stringify(contacts), id]);
  await client.query(`INSERT INTO publicador_historico (publicador_id, campo_alterado, valor_antigo, valor_novo, data_mudanca)
    VALUES ($1, 'contatos_emergencia', $2, $3, NOW())`, [id, oldValue || null, newValue || null]);
}
