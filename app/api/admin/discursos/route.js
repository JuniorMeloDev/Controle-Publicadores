
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Helper to ensure table exists
async function ensureTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS discursos_publicos (
            id SERIAL PRIMARY KEY,
            data DATE NOT NULL,
            orador VARCHAR(255),
            tema VARCHAR(255),
            cantico INTEGER,
            congregacao VARCHAR(255),
            presidente_id INTEGER REFERENCES publicadores(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

export async function GET(request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // "2025-12"
    
    await ensureTable(client);

    let queryText = `
        SELECT d.*, p.nome_chamado, p.nome_completo 
        FROM discursos_publicos d
        LEFT JOIN publicadores p ON d.presidente_id = p.id
    `;
    const params = [];

    if (month) {
        queryText += ` WHERE to_char(d.data, 'YYYY-MM') = $1`;
        params.push(month);
    }

    queryText += ` ORDER BY d.data ASC`;

    const res = await client.query(queryText, params);
    
    // Format for frontend
    const discursos = res.rows.map(row => ({
        ...row,
        // Convert Date to YYYY-MM-DD string
        data: new Date(row.data).toISOString().split('T')[0]
    }));

    return NextResponse.json(discursos, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar discursos:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { id, data, orador, tema, cantico, congregacao, presidente_id } = body;
    
    if (!data) {
        return NextResponse.json({ message: 'Data é obrigatória.' }, { status: 400 });
    }

    await ensureTable(client);

    let res;
    if (id) {
        // Update
        res = await client.query(`
            UPDATE discursos_publicos 
            SET data=$1, orador=$2, tema=$3, cantico=$4, congregacao=$5, presidente_id=$6
            WHERE id=$7
            RETURNING *
        `, [data, orador, tema, cantico, congregacao, presidente_id, id]);
    } else {
        // Create
        res = await client.query(`
            INSERT INTO discursos_publicos (data, orador, tema, cantico, congregacao, presidente_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [data, orador, tema, cantico, congregacao, presidente_id]);
    }

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao salvar discurso:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request) {
    const client = await pool.connect();
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ message: 'ID required' }, { status: 400 });

        await client.query('DELETE FROM discursos_publicos WHERE id = $1', [id]);
        return NextResponse.json({ message: 'Deletado' }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Erro ao deletar' }, { status: 500 });
    } finally {
        client.release();
    }
}
