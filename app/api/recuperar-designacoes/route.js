import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

// Força a rota a ser dinâmica para não cachear dados antigos
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json([], { status: 200 });
  }

  const client = await pool.connect();
  try {
    // Busca as designações e o nome do publicador
    // Ordena por ID para tentar manter a ordem de quem é estudante/ajudante
    const res = await client.query(`
      SELECT d.nome_parte, p.nome_completo
      FROM designacoes_reuniao d
      JOIN publicadores p ON d.publicador_id = p.id
      WHERE d.data_reuniao = $1
      ORDER BY d.id ASC
    `, [date]);
    
    return NextResponse.json(res.rows, { status: 200 });
  } catch (err) {
    console.error('Erro ao recuperar designações:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}