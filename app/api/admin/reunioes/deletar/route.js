import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isInteger(id) || id <= 0)) {
    return NextResponse.json({ message: 'IDs inválidos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
    if (!isAllowed(permissions, 'configuracoes_editar', 'actions')) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    await client.query('BEGIN');

    // Delete reunioes_registro
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await client.query(`UPDATE reunioes_registro SET cancelada = TRUE,
      motivo_cancelamento = 'Reunião cancelada pelo administrador.' WHERE id IN (${placeholders}) AND cancelada = FALSE RETURNING id`, ids);

    await client.query('COMMIT');

    return NextResponse.json({ message: 'Reuniões canceladas. O histórico e as designações foram preservados.', count: result.rowCount }, { status: 200 });
  } catch (err) {
    console.error('[DELETE /api/admin/reunioes/deletar] Erro ao deletar reuniões:', err);
    await client.query('ROLLBACK');
    return NextResponse.json({ message: 'Erro interno ao deletar reuniões.' }, { status: 500 });
  } finally {
    client.release();
  }
}
