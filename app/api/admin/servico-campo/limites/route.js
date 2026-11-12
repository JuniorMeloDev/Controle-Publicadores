import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/app/lib/request-authorization';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { registerAuditLog } from '@/app/lib/audit-log';
import { readTerritoryBoundaries, saveTerritoryBoundary } from '@/app/lib/territory-boundaries-server';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
function failure(error) {
  console.error('Erro nos limites dos territórios:', error.message);
  return NextResponse.json({ message: error.code === '42P01' || error.code === '42703'
    ? 'Atualize o banco executando npm run migrate:field-service.'
    : error.status ? error.message : 'Não foi possível salvar ou carregar os limites.' }, { status: error.status || 500 });
}
export async function GET(request) {
  const denied = await authorizeRequest(request, 'GET');
  if (denied) return denied;
  let client;
  try { client = await pool.connect(); return NextResponse.json(await readTerritoryBoundaries(client), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return failure(error); }
  finally { client?.release(); }
}
export async function POST(request) {
  const denied = await authorizeRequest(request, 'POST');
  if (denied) return denied;
  let body;
  try { body = await request.json(); if (!body || typeof body !== 'object') throw new Error(); }
  catch { return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 }); }
  let client; let transaction = false;
  try {
    client = await pool.connect(); await client.query('BEGIN'); transaction = true;
    const result = await saveTerritoryBoundary(client, body);
    await registerAuditLog(client, { userId: getUserIdFromRequest(request), action: 'campo_limite_salvo', entity: 'campo_territorio', entityId: result.id || 'geral', details: { revisao: result.revisao, ...(body.referencia_ids!==undefined?{referencia_ids:body.referencia_ids}:{}) } });
    await client.query('COMMIT'); transaction = false;
    return NextResponse.json(result);
  } catch (error) { if (transaction) await client.query('ROLLBACK'); return failure(error); }
  finally { client?.release(); }
}
