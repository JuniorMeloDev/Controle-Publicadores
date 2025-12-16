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
  const limit = parseInt(searchParams.get('limit') || '10');

  const client = await pool.connect();

  try {
    // 1. Fetch Meetings
    const params = [start];
    let query = `SELECT id, data, tipo FROM reunioes_registro WHERE data >= $1`;
    
    if (end) {
        query += ` AND data <= $2`;
        params.push(end);
    }
    query += ` ORDER BY data ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const meetingsRes = await client.query(query, params);
    const meetings = meetingsRes.rows;

    if (meetings.length === 0) {
        return NextResponse.json({ meetings: [], types: [], assignments: {} });
    }

    const meetingIds = meetings.map(m => m.id);

    // 2. Fetch Active Types
    const typesRes = await client.query('SELECT id, nome FROM privilegios_tipos WHERE ativo = true ORDER BY ordem ASC');
    const types = typesRes.rows;

    // 3. Fetch Assignments for these meetings
    const assignmentsRes = await client.query(`
        SELECT 
            rp.reuniao_id,
            rp.privilegio_tipo_id,
            p.nome_completo,
            p.nome_chamado
        FROM reunioes_privilegios rp
        JOIN publicadores p ON rp.publicador_id = p.id
        WHERE rp.reuniao_id = ANY($1)
    `, [meetingIds]);

    // 4. Map Assignments: { meetingId: { typeId: { nome_completo, nome_chamado } } }
    const assignments = {};
    assignmentsRes.rows.forEach(row => {
        if (!assignments[row.reuniao_id]) assignments[row.reuniao_id] = {};
        assignments[row.reuniao_id][row.privilegio_tipo_id] = {
            nome: row.nome_completo,
            chamado: row.nome_chamado
        };
    });

    return NextResponse.json({ meetings, types, assignments }, { status: 200 });

  } catch (err) {
    console.error('Erro ao buscar relatorio:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
