import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

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
    await client.query('BEGIN');

    let eventDate;
    if (id) {
      const meetingRes = await client.query('SELECT data FROM reunioes_registro WHERE id = $1', [id]);
      if (meetingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Reunião não encontrada.' }, { status: 404 });
      }
      eventDate = meetingRes.rows[0].data;
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
