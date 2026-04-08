import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function DELETE(request) {
  const body = await request.json();
  const publicadorId = Number(String(body?.publicadorId || '').trim());

  if (!publicadorId || Number.isNaN(publicadorId)) {
    return NextResponse.json({ message: 'ID de publicador inválido.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const userId = getUserIdFromRequest(request);
    const perms = await getUserPermissions(client, userId);
    if (!isAllowed(perms, 'publicadores_editar', 'actions')) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    await client.query('BEGIN');
    const publicadorRes = await client.query('SELECT nome_completo FROM publicadores WHERE id = $1 FOR UPDATE', [publicadorId]);
    if (publicadorRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Publicador não encontrado.' }, { status: 404 });
    }

    // Delete related records in cascata to avoid foreign key violations
    await client.query('DELETE FROM relatorios_mensais WHERE publicador_id = $1', [publicadorId]);
    await client.query('DELETE FROM designacoes_reuniao WHERE publicador_id = $1', [publicadorId]);
    await client.query('DELETE FROM publicador_historico WHERE publicador_id = $1', [publicadorId]);
    await client.query('DELETE FROM discursos_publicos WHERE presidente_id = $1', [publicadorId]);
    
    // Delete the publisher (acessos_app will be deleted automatically due to ON DELETE CASCADE)
    await client.query('DELETE FROM publicadores WHERE id = $1', [publicadorId]);
    await registerAuditLog(client, {
      userId,
      action: 'publicador_excluido',
      entity: 'publicador',
      entityId: publicadorId,
      details: { nome_completo: publicadorRes.rows[0].nome_completo }
    });
    await client.query('COMMIT');

    return NextResponse.json({ message: 'Publicador excluído com sucesso.' }, { status: 200 });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ message: 'Erro interno ao excluir publicador.' }, { status: 500 });
  } finally {
    client.release();
  }
}
