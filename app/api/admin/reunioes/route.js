
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET: List recent meetings with summary
export async function GET() {
  const client = await pool.connect();
  try {
    const queryMeetings = async () => {
        return client.query(`
          SELECT 
            r.id, r.data, r.tipo, r.observacoes,
            COUNT(CASE WHEN a.modalidade = 'Presencial' THEN 1 END)::int as presencial,
            COUNT(CASE WHEN a.modalidade = 'Zoom' THEN 1 END)::int as zoom,
            COUNT(a.id)::int as total
          FROM reunioes_registro r
          LEFT JOIN assistencia_detalhe a ON r.id = a.reuniao_id
          GROUP BY r.id
          ORDER BY r.data DESC
          LIMIT 20
        `);
    };

    let res;
    try {
        res = await queryMeetings();
    } catch (err) {
        // Se a tabela não existe, cria e tenta de novo (Lazy Migration)
        if (err.code === '42P01') { 
            console.log("Tabelas não encontradas. Criando...");
            await client.query('BEGIN');
            await client.query(`
                CREATE TABLE IF NOT EXISTS reunioes_registro (
                    id SERIAL PRIMARY KEY,
                    data DATE NOT NULL UNIQUE,
                    tipo VARCHAR(50) NOT NULL,
                    observacoes TEXT,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await client.query(`
                 CREATE TABLE IF NOT EXISTS assistencia_detalhe (
                    id SERIAL PRIMARY KEY,
                    reuniao_id INTEGER REFERENCES reunioes_registro(id) ON DELETE CASCADE,
                    publicador_id INTEGER REFERENCES publicadores(id) ON DELETE CASCADE,
                    modalidade VARCHAR(20) NOT NULL,
                    UNIQUE(reuniao_id, publicador_id)
                 );
            `);
            await client.query('COMMIT');
            res = await queryMeetings(); // Tenta novamente
        } else {
            throw err;
        }
    }
    
    // Format dates safely
    const meetings = res.rows.map(row => ({
        ...row,
        data_formatada: new Date(row.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})
    }));

    return NextResponse.json(meetings, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar reuniões:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST: Create new meeting
export async function POST(request) {
  const client = await pool.connect();
  try {
    const { data, tipo } = await request.json();
    
    if (!data || !tipo) {
        return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });
    }

    const res = await client.query(`
      INSERT INTO reunioes_registro (data, tipo)
      VALUES ($1, $2)
      RETURNING id, data, tipo
    `, [data, tipo]);

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao criar reunião:', err);
    if (err.code === '23505') { // Unique violation
        return NextResponse.json({ message: 'Já existe uma reunião nesta data.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
