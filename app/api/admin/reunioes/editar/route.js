import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const body = await request.json();
  const { id, nova_data } = body;

  if (!id || !nova_data) {
    return NextResponse.json({ message: 'ID e data são obrigatórios.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify meeting exists
    const meetingRes = await client.query('SELECT id FROM reunioes_registro WHERE id = $1', [id]);
    if (meetingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Reunião não encontrada.' }, { status: 404 });
    }

    // Update data
    await client.query('UPDATE reunioes_registro SET data = $1 WHERE id = $2', [nova_data, id]);

    await client.query('COMMIT');

    return NextResponse.json({ message: 'Data alterada com sucesso.' }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/admin/reunioes/editar] Erro ao editar reunião:', err);
    await client.query('ROLLBACK');
    return NextResponse.json({ message: 'Erro interno ao editar reunião.' }, { status: 500 });
  } finally {
    client.release();
  }
}
