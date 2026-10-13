import { authorizeRequest } from '@/app/lib/request-authorization';
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from '@/app/lib/server-access';
import { updateAccess } from '@/app/lib/access-management';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req) {
  const denied = await authorizeRequest(req, 'GET');
  if (denied) return denied;
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  const client = await pool.connect();
  try {
    if (!(await getUserAccess(client, userId))?.isSuperAdmin) return reply({ message: 'Acesso negado.' }, 403);
    const users = await client.query('SELECT id, nome_completo, nome_chamado, privilegios, designacoes FROM publicadores ORDER BY nome_completo');
    const access = await client.query('SELECT publicador_id, permissoes, super_admin FROM acessos_app');
    return reply({ publicadores: users.rows, acessos: access.rows });
  } catch { return reply({ message: 'Não foi possível carregar os acessos.' }, 500); }
  finally { client.release(); }
}

export async function POST(req) {
  const denied = await authorizeRequest(req, 'POST');
  if (denied) return denied;
  const userId = getUserIdFromRequest(req);
  if (!userId) return reply({ message: 'Não autenticado.' }, 401);
  let body;
  try { body = await req.json(); } catch { return reply({ message: 'Dados inválidos.' }, 400); }
  const client = await pool.connect();
  try {
    const result = await updateAccess(client, userId, body);
    return reply({ message: result.message, permissions: result.permissions }, result.status);
  } catch { return reply({ message: 'Não foi possível atualizar o acesso.' }, 500); }
  finally { client.release(); }
}
