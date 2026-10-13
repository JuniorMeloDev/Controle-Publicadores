import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserAccess } from './server-access.js';
import { canAccessRoute } from './route-access.js';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Return a denial response, or null when authorized. Called inside route handlers as well as middleware.
export async function authorizeRequest(request, method) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  const pathname = new URL(request.url).pathname;
  const origin = request.headers.get('origin');
  if (!['GET', 'HEAD'].includes(method) && origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: 'Origem da solicitação inválida.' }, { status: 403 });
  }
  let client;
  try {
    client = await pool.connect();
    const access = await getUserAccess(client, userId);
    const allowed = pathname === '/api/recuperar-designacoes' ? access?.permissions?.pages?.designacoes === true
      : pathname === '/api/enviar-relatorio-mensal/manual' ? access?.permissions?.actions?.relatorios_editar === true
        : canAccessRoute(access, pathname, method);
    if (!allowed) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    if (pathname.startsWith('/api/admin/get-relatorios/') && new URL(request.url).searchParams.get('export') === '1'
      && access.permissions?.actions?.s21_exportar !== true) {
      return NextResponse.json({ message: 'Sem permissão para exportar S-21.' }, { status: 403 });
    }
    if (['POST', 'PUT', 'PATCH'].includes(method) && (pathname.includes('/criar-publicador') || pathname.includes('/update-publicador/'))) {
      const body = await request.clone().json();
      if (body.senha) return NextResponse.json({ message: 'A senha deve ser definida pelo próprio usuário no link de recuperação.' }, { status: 400 });
      if (!access.isSuperAdmin && pathname.includes('/update-publicador/')) {
        const targetId = Number(pathname.split('/').pop());
        const target = await client.query(`SELECT p.email, COALESCE(a.super_admin, FALSE) AS super_admin
          FROM publicadores p LEFT JOIN acessos_app a ON a.publicador_id = p.id WHERE p.id = $1`, [targetId]);
        if (target.rows[0]?.super_admin || (target.rows.length && String(body.email || '').trim().toLowerCase() !== String(target.rows[0].email || '').trim().toLowerCase())) {
          return NextResponse.json({ message: 'Somente um super admin pode editar esta conta ou alterar o e-mail de acesso.' }, { status: 403 });
        }
      }
    }
    if (!access.isSuperAdmin && pathname === '/api/admin/atualizacoes-cadastrais' && method === 'POST') {
      const body = await request.clone().json();
      if (Array.isArray(body.ids)) {
        const protectedChanges = await client.query(`SELECT c.id FROM cadastro_alteracoes c
          LEFT JOIN acessos_app a ON a.publicador_id = c.publicador_id
          WHERE c.id = ANY($1::int[]) AND (c.campo = 'email' OR a.super_admin = TRUE)`, [body.ids]);
        if (protectedChanges.rows.length) return NextResponse.json({ message: 'Somente um super admin pode revisar alterações de e-mail ou de contas super admin.' }, { status: 403 });
      }
    }
    return null;
  } catch { return NextResponse.json({ message: 'Não foi possível verificar seu acesso.' }, { status: 503 }); }
  finally { client?.release(); }
}
