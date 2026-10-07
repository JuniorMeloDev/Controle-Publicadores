import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getPublisherAssignments } from '@/app/lib/publisher-assignments';

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
    const assignments = await getPublisherAssignments(client, { publisherId: id, futureOnly: true });
    
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
        assignments: assignments.filter(a => a.origem !== 'vida_ministerio' || !/^(Comentários|Cântico)/i.test(a.nome_parte))
    }, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar designações do publicador:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
