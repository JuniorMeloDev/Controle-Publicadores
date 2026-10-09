import { ensureEmergencyContactsColumn } from './emergency-contacts-server';
import { Pool } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { CADASTRO_FIELDS } from './cadastro-update';
export const cadastroPool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
export async function ensureCadastroTables(client) {
  await ensureEmergencyContactsColumn(client);
  await client.query(`CREATE TABLE IF NOT EXISTS cadastro_sessoes (
    token_hash TEXT PRIMARY KEY, publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS cadastro_alteracoes (
    id SERIAL PRIMARY KEY, envio_id TEXT NOT NULL, publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
    campo TEXT NOT NULL, valor_antigo TEXT, valor_novo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente', criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revisado_em TIMESTAMPTZ, revisado_por INTEGER REFERENCES publicadores(id) ON DELETE SET NULL
  )`);
  await client.query(`CREATE INDEX IF NOT EXISTS cadastro_alteracoes_status_idx ON cadastro_alteracoes(status, publicador_id)`);
  await client.query(`CREATE TABLE IF NOT EXISTS cadastro_tentativas (
    chave TEXT PRIMARY KEY, inicio TIMESTAMPTZ NOT NULL, quantidade INTEGER NOT NULL
  )`);
}
export async function limitCadastroAttempts(client, request, scope) {
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'local';
  const key = tokenHash(`${scope}:${ip.split(',')[0].trim()}`);
  const result = await client.query(`INSERT INTO cadastro_tentativas (chave, inicio, quantidade) VALUES ($1, NOW(), 1)
    ON CONFLICT (chave) DO UPDATE SET
      quantidade = CASE WHEN cadastro_tentativas.inicio < NOW() - INTERVAL '15 minutes' THEN 1 ELSE cadastro_tentativas.quantidade + 1 END,
      inicio = CASE WHEN cadastro_tentativas.inicio < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE cadastro_tentativas.inicio END
    RETURNING quantidade`, [key]);
  return result.rows[0].quantidade <= 15;
}
export async function applyCadastroField(client, id, field, oldValue, value) {
  if (!CADASTRO_FIELDS.some(([key]) => key === field)) throw new Error('Campo inválido.');
  await client.query(`UPDATE publicadores SET ${field} = ${field === 'contatos_emergencia' ? '$1::jsonb' : '$1'} WHERE id = $2`, [value, id]);
  await client.query(`INSERT INTO publicador_historico
    (publicador_id, campo_alterado, valor_antigo, valor_novo, data_mudanca) VALUES ($1, $2, $3, $4, NOW())`,
    [id, field, oldValue || null, value]);
}
