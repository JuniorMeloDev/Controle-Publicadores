import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { getPublisherAssignments } from '@/app/lib/publisher-assignments';
import { CADASTRO_FIELDS, personalData } from '@/app/lib/cadastro-update';
import { ensureCadastroTables, tokenHash } from '@/app/lib/cadastro-update-server';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function getOwnData(client, userId) {
  const result = await client.query(`SELECT p.id, ${CADASTRO_FIELDS.map(([key]) => `p.${key}`).join(', ')},
    p.privilegios, p.designacoes, p.esperanca, g.nome_grupo FROM publicadores p
    LEFT JOIN grupos g ON g.id = p.grupo_id WHERE p.id = $1`, [userId]);
  return result.rows[0];
}

export async function GET(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  let client;
  try {
    client = await pool.connect();
    if (!await getUserAccess(client, userId)) return reply({ message: 'Conta não encontrada.' }, 401);
    await ensureCadastroTables(client);
    const info = await getOwnData(client, userId);
    const reports = await client.query(`SELECT mes, ano_servico, participou_ministerio, pioneiro_auxiliar,
      estudos_biblicos, horas, observacoes FROM relatorios_mensais WHERE publicador_id = $1 ORDER BY ano_servico DESC`, [userId]);
    const assignments = await getPublisherAssignments(client, { publisherId: userId, futureOnly: false });
    const pending = await client.query("SELECT COUNT(*)::int AS total FROM cadastro_alteracoes WHERE publicador_id = $1 AND status = 'pendente'", [userId]);
    return reply({ info, reports: reports.rows, assignments, pendingChanges: pending.rows[0].total });
  } catch { return reply({ message: 'Não foi possível carregar seus dados.' }, 500); }
  finally { client?.release(); }
}

// Creates an update session from the logged-in user's ID; caller-supplied IDs are never used.
export async function POST(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  let client;
  try {
    client = await pool.connect();
    if (!await getUserAccess(client, userId)) return reply({ message: 'Conta não encontrada.' }, 401);
    await ensureCadastroTables(client);
    const info = await getOwnData(client, userId);
    const snapshot = personalData(info);
    const token = randomBytes(32).toString('hex');
    await client.query(`INSERT INTO cadastro_sessoes (token_hash, publicador_id, snapshot, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`, [tokenHash(token), userId, JSON.stringify(snapshot)]);
    return reply({ dados: snapshot, token });
  } catch { return reply({ message: 'Não foi possível iniciar a atualização.' }, 500); }
  finally { client?.release(); }
}
