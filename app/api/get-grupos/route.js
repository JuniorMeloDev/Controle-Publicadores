import { Pool } from '@neondatabase/serverless'; 
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // Simplesmente seleciona o nome de todos os grupos
    const res = await client.query('SELECT nome_grupo FROM grupos ORDER BY nome_grupo ASC');
    
    // Retorna a lista de nomes
    // Ex: ["Grupo 1", "Grupo 2", "Grupo 3"]
    const grupos = res.rows.map(row => row.nome_grupo); 
    
    return NextResponse.json(grupos, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar grupos:', err);
    return NextResponse.json({ message: 'Erro ao buscar grupos.' }, { status: 500 });
  } finally {
    client.release();
  }
}