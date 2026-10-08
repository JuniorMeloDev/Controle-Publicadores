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
  const { id, data } = body;

  if (!id && !data) {
    return NextResponse.json({ message: 'ID ou data da reunião é obrigatório.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
    if (!isAllowed(permissions, 'configuracoes_editar', 'actions')) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    await client.query('BEGIN');

    let eventDate;
    if (id) {
      const meetingRes = await client.query('SELECT data, cancelada FROM reunioes_registro WHERE id = $1 FOR UPDATE', [id]);
      if (meetingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Reunião não encontrada.' }, { status: 404 });
      }
      eventDate = meetingRes.rows[0].data;
      if (meetingRes.rows[0].cancelada) {
        await client.query('UPDATE reunioes_registro SET cancelada = FALSE, motivo_cancelamento = NULL WHERE id = $1', [id]);
        await client.query('COMMIT');
        return NextResponse.json({ message: 'Reunião restaurada. As designações foram mantidas.' });
      }
    } else {
      eventDate = data;
    }

    const deleteResult = await client.query('DELETE FROM eventos_especiais WHERE data = $1 RETURNING id', [eventDate]);
    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Evento especial não encontrado para esta reunião.' }, { status: 404 });
    }

    await client.query('COMMIT');

    return NextResponse.json({ message: 'Restrição removida com sucesso.' }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/admin/reunioes/remover-evento-especial] Erro:', err);
    await client.query('ROLLBACK');
    return NextResponse.json({ message: 'Erro interno ao remover restrição.' }, { status: 500 });
  } finally {
    client.release();
  }
}
