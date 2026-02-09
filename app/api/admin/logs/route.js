import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { ensureAuditTable } from '@/app/lib/audit-log';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const client = await pool.connect();
  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'logs_visualizar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    await ensureAuditTable(client);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const user = searchParams.get('user');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const filters = [];
    const values = [];

    if (action) {
      values.push(action);
      filters.push(`l.action = $${values.length}`);
    }
    if (entity) {
      values.push(entity);
      filters.push(`l.entity = $${values.length}`);
    }
    if (user) {
      values.push(user);
      filters.push(`l.user_id = $${values.length}`);
    }
    if (from) {
      values.push(from);
      filters.push(`l.created_at >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      filters.push(`l.created_at <= $${values.length}`);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    values.push(limit);
    const limitParam = values.length;
    values.push(offset);
    const offsetParam = values.length;

    const res = await client.query(
      `
        SELECT 
          l.id,
          l.user_id,
          l.action,
          l.entity,
          l.entity_id,
          l.details,
          l.created_at,
          p.nome_completo,
          p.nome_chamado
        FROM auditoria_logs l
        LEFT JOIN publicadores p ON p.id = l.user_id
        ${where}
        ORDER BY l.created_at DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      values
    );

    return NextResponse.json(res.rows, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar logs:', err);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    client.release();
  }
}
