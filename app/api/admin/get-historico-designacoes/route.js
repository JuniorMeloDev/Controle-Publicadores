import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // Busca designações dos últimos 3 meses (90 dias)
    const res = await client.query(`
      SELECT 
        d.publicador_id, 
        d.nome_parte, 
        d.data_reuniao,
        p.nome_completo 
      FROM designacoes_reuniao d
      JOIN publicadores p ON d.publicador_id = p.id
      WHERE d.data_reuniao >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY d.data_reuniao DESC
    `);
    
    return NextResponse.json(res.rows, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    return NextResponse.json({ message: 'Erro ao buscar histórico.' }, { status: 500 });
  } finally {
    client.release();
  }
}
