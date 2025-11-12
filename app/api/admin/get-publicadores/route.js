import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // Este SQL junta as tabelas publicadores e grupos
    // para que tenhamos o nome do grupo em vez do ID.
    const res = await client.query(`
      SELECT 
        p.id, 
        p.nome_completo, 
        p.data_nascimento, 
        g.nome_grupo, 
        p.privilegios, 
        p.designacoes 
      FROM publicadores p
      LEFT JOIN grupos g ON p.grupo_id = g.id
      ORDER BY p.nome_completo ASC
    `);
    
    return NextResponse.json(res.rows, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar publicadores:', err);
    return NextResponse.json({ message: 'Erro ao buscar publicadores.' }, { status: 500 });
  } finally {
    client.release();
  }
}