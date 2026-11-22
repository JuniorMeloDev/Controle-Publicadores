import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { registerAuditLog } from '@/app/lib/audit-log';
import { findSharedSchematic } from '@/app/lib/territory-schematic-server';
import { readTerritoryProgress, saveTerritoryProgress } from '@/app/lib/territory-progress-server';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const json = (value, status = 200) => NextResponse.json(value, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

async function userFor(client, userId) {
  return userId ? (await getUserAccess(client, userId))?.user || null : null;
}

function failure(error) {
  if (error.status) return json({ message: error.message }, error.status);
  if (error.code === '42703') return json({ message: 'O registro de quadras aguarda a atualização do banco de dados.' }, 503);
  console.error('Progresso do território:', error.code || error.name);
  return json({ message: 'Não foi possível acessar o progresso do território. Tente novamente.' }, 500);
}

export async function GET(request, { params }) {
  const { token } = await params;
  let client;
  try {
    client = await pool.connect();
    const territory = await findSharedSchematic(client, token);
    if (!territory) return json({ message: 'Mapa não encontrado.' }, 404);
    const user = await userFor(client, getUserIdFromRequest(request));
    return json((await readTerritoryProgress(client, territory, user)).state);
  } catch (error) { return failure(error); }
  finally { client?.release(); }
}

export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return json({ message: 'Entre na sua conta para registrar o progresso.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ message: 'Origem da solicitação inválida.' }, 403);
  const { token } = await params;
  let body;
  try { body = await request.json(); }
  catch { return json({ message: 'Dados inválidos.' }, 400); }

  let client, transaction = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transaction = true;
    await client.query('SELECT pg_advisory_xact_lock(73428191)');
    const territory = await findSharedSchematic(client, token, { lock: true });
    if (!territory) {
      await client.query('ROLLBACK');
      transaction = false;
      return json({ message: 'Mapa não encontrado.' }, 404);
    }
    const user = await userFor(client, userId);
    const context = await readTerritoryProgress(client, territory, user);
    const result = await saveTerritoryProgress(client, territory, user, body, context);
    if (result.changed) await registerAuditLog(client, {
      userId, action: body.action === 'complete' ? 'campo_designacoes_complete_mapa' : 'campo_designacoes_quadras',
      entity: 'campo_designacoes', entityId: result.id,
      details: { territorio_id: territory.id, saida_id: context.outing?.id, data: context.today, quadras_concluidas: result.completed },
    });
    const state = (await readTerritoryProgress(client, territory, user, context.today)).state;
    await client.query('COMMIT');
    transaction = false;
    return json(state);
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    return failure(error);
  } finally { client?.release(); }
}
