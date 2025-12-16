
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const theme = searchParams.get('theme');
  const speaker = searchParams.get('speaker');
  const congregation = searchParams.get('congregation');

  const client = await pool.connect();

  try {
    let query = `
      SELECT 
        d.id,
        d.data,
        d.tema,
        d.orador,
        d.congregacao,
        d.cantico,
        p.nome_chamado as presidente_nome,
        p.nome_completo as presidente_completo
      FROM discursos_publicos d
      LEFT JOIN publicadores p ON d.presidente_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (start) {
        query += ` AND d.data >= $${params.length + 1}`;
        params.push(start);
    }

    if (end) {
        query += ` AND d.data <= $${params.length + 1}`;
        params.push(end);
    }

    if (theme) {
        query += ` AND d.tema ILIKE $${params.length + 1}`;
        params.push(`%${theme}%`);
    }

    if (speaker) {
        query += ` AND d.orador ILIKE $${params.length + 1}`;
        params.push(`%${speaker}%`);
    }

    if (congregation) {
        query += ` AND d.congregacao ILIKE $${params.length + 1}`;
        params.push(`%${congregation}%`);
    }

    query += ` ORDER BY d.data ASC`;

    const res = await client.query(query, params);

    const speeches = res.rows.map(row => ({
        ...row,
        data: new Date(row.data).toISOString().split('T')[0]
    }));
    
    return NextResponse.json(speeches, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar relatorio de discursos:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
