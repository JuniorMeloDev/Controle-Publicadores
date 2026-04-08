import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request) {
  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ message: 'IDs inválidos.' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete reunioes_registro
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await client.query(`DELETE FROM reunioes_registro WHERE id IN (${placeholders})`, ids);

    await client.query('COMMIT');

    return NextResponse.json({ message: 'Reuniões deletadas com sucesso.', count: ids.length }, { status: 200 });
  } catch (err) {
    console.error('[DELETE /api/admin/reunioes/deletar] Erro ao deletar reuniões:', err);
    await client.query('ROLLBACK');
    return NextResponse.json({ message: 'Erro interno ao deletar reuniões.' }, { status: 500 });
  } finally {
    client.release();
  }
}
