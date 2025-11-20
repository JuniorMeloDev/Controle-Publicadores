// app/api/admin/get-reunioes/route.js
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // Busca as reuniões salvas, ordenadas da mais recente para a mais antiga
    const res = await client.query(`
      SELECT data_reuniao, descricao_texto 
      FROM reunioes_dados 
      ORDER BY data_reuniao DESC
    `);
    
    // Formata a data para exibição
    const reunioes = res.rows.map(row => ({
      dataSQL: row.data_reuniao.toISOString().split('T')[0], // YYYY-MM-DD
      descricao: row.descricao_texto || 'Sem descrição',
      dataFormatada: new Date(row.data_reuniao).toLocaleDateString('pt-BR', {
        timeZone: 'UTC'
      })
    }));

    return NextResponse.json(reunioes, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar lista de reuniões:', err);
    return NextResponse.json({ message: 'Erro ao buscar histórico.' }, { status: 500 });
  } finally {
    client.release();
  }
}