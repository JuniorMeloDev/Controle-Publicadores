import { createHash, randomBytes } from 'node:crypto';

export const responseLabels = { sem_resposta: 'Sem resposta — designação válida', sim: 'Confirmada', nao: 'Recusada — aguardando substituição' };
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const assignmentVersion = a => hashToken(JSON.stringify([a.id, String(a.publicador_id), String(a.data_reuniao instanceof Date ? a.data_reuniao.toISOString() : a.data_reuniao).slice(0, 10), a.nome_parte, a.descricao_semana || '', a.reuniao_id || null]));

export async function ensureResponseTables(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS designacoes_respostas (
    versao TEXT PRIMARY KEY, designacao_id TEXT NOT NULL, publicador_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
    dados JSONB NOT NULL, resposta TEXT NOT NULL DEFAULT 'sem_resposta' CHECK (resposta IN ('sem_resposta','sim','nao')),
    respondida_em TIMESTAMPTZ, origem TEXT, expira_em TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS designacoes_respostas_tokens (
    token_hash TEXT PRIMARY KEY, versao TEXT NOT NULL REFERENCES designacoes_respostas(versao)
  );
  CREATE TABLE IF NOT EXISTS designacoes_recusas_avisos (
    id BIGSERIAL PRIMARY KEY, versao TEXT NOT NULL REFERENCES designacoes_respostas(versao),
    destinatario_id INTEGER NOT NULL REFERENCES publicadores(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), enviado_em TIMESTAMPTZ, tentativa_em TIMESTAMPTZ,
    UNIQUE (versao, destinatario_id)
  )`);
}

export async function withAssignmentResponses(client, assignments) {
  await ensureResponseTables(client);
  const { rows } = await client.query('SELECT versao, resposta FROM designacoes_respostas WHERE versao = ANY($1::text[])', [assignments.map(assignmentVersion)]);
  const responses = new Map(rows.map(r => [r.versao, r.resposta]));
  return assignments.map(a => ({ ...a, versao: assignmentVersion(a), resposta: responses.get(assignmentVersion(a)) || 'sem_resposta' }));
}

export async function createResponseLink(client, assignment, origin) {
  await ensureResponseTables(client);
  const token = randomBytes(32).toString('hex');
  // Re-sends keep previous links and responses valid.
  await client.query(`INSERT INTO designacoes_respostas
    (versao, designacao_id, publicador_id, dados, expira_em)
    VALUES ($1,$2,$3,$4,($5::date + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo')
    ON CONFLICT (versao) DO NOTHING RETURNING versao`,
  [assignmentVersion(assignment), assignment.id, assignment.publicador_id, JSON.stringify(assignment), assignment.data_reuniao]);
  await client.query('INSERT INTO designacoes_respostas_tokens (token_hash, versao) VALUES ($1,$2)', [hashToken(token), assignmentVersion(assignment)]);
  return `${origin}/confirmar-designacao#token=${token}`;
}

export async function recordAssignmentResponse(client, assignment, answer, source) {
  if (!['sim', 'nao'].includes(answer)) throw new Error('Resposta inválida.');
  const version = assignmentVersion(assignment);
  await client.query(`INSERT INTO designacoes_respostas (versao, designacao_id, publicador_id, dados, expira_em)
    VALUES ($1,$2,$3,$4,($5::date + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo') ON CONFLICT DO NOTHING`,
  [version, assignment.id, assignment.publicador_id, JSON.stringify(assignment), assignment.data_reuniao]);
  const { rows } = await client.query(`UPDATE designacoes_respostas SET resposta=$2, respondida_em=NOW(), origem=$3
    WHERE versao=$1 AND resposta='sem_resposta' AND expira_em > NOW() RETURNING versao`, [version, answer, source]);
  if (!rows.length) return false;
  if (answer === 'nao') await client.query(`INSERT INTO designacoes_recusas_avisos (versao, destinatario_id)
    SELECT $1, a.publicador_id FROM acessos_app a WHERE a.super_admin=TRUE
      OR a.permissoes->'actions'->'designacoes_confirmacoes' = 'true'::jsonb ON CONFLICT DO NOTHING`, [version]);
  return true;
}
