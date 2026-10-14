import { overviewSnapshot, detectOverviewChanges, mergeOverviewChanges } from './overview-changes';

export async function ensureOverviewState(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS visao_geral_estado (
    publicador_id INTEGER PRIMARY KEY REFERENCES publicadores(id) ON DELETE CASCADE,
    snapshot JSONB, mudancas JSONB NOT NULL DEFAULT '[]'::jsonb,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export async function recordOverviewChanges(client, userId, meetings, assignments, today, detectedAt = new Date().toISOString()) {
  await ensureOverviewState(client);
  await client.query('BEGIN');
  try {
    await client.query('INSERT INTO visao_geral_estado (publicador_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    const result = await client.query('SELECT snapshot, mudancas FROM visao_geral_estado WHERE publicador_id = $1 FOR UPDATE', [userId]);
    const before = result.rows[0];
    const snapshot = overviewSnapshot(meetings, assignments);
    const changes = mergeOverviewChanges(before.mudancas, detectOverviewChanges(before.snapshot, snapshot, today, detectedAt), today);
    await client.query('UPDATE visao_geral_estado SET snapshot = $2, mudancas = $3, atualizado_em = NOW() WHERE publicador_id = $1',
      [userId, JSON.stringify(snapshot), JSON.stringify(changes)]);
    await client.query('COMMIT');
    return changes;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
