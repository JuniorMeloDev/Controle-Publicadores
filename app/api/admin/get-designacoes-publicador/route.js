import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT d.data_reuniao, d.nome_parte
      FROM designacoes_reuniao d
      WHERE d.publicador_id = $1 
      AND d.data_reuniao >= CURRENT_DATE
      AND d.nome_parte NOT ILIKE 'Comentários%'
      AND d.nome_parte NOT ILIKE 'Cântico%'
      ORDER BY d.data_reuniao ASC
    `, [id]);
    
    // Also fetch publisher name for the modal title
    const pubRes = await client.query('SELECT nome_completo, nome_chamado FROM publicadores WHERE id = $1', [id]);
    const pub = pubRes.rows[0];
    
    let publisherName = 'Publicador';
    if (pub) {
        if (pub.nome_chamado) {
            publisherName = pub.nome_chamado;
        } else if (pub.nome_completo) {
            const parts = pub.nome_completo.trim().split(' ').filter(Boolean);
            if (parts.length > 1) {
                publisherName = `${parts[0]} ${parts[parts.length - 1]}`;
            } else {
                publisherName = pub.nome_completo;
            }
        }
    }

    return NextResponse.json({
        publisher: publisherName,
        assignments: res.rows
    }, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar designações do publicador:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
