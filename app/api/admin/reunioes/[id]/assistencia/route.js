
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET: Get attendance detail for a meeting
export async function GET(request, { params }) {
  const { id } = await params;
  
  if (!id) return NextResponse.json({ message: 'ID da reunião obrigatório' }, { status: 400 });

  const client = await pool.connect();
  try {
    const queryAssistance = async () => {
        return client.query(`
          SELECT 
            p.id as publicador_id, 
            p.nome_completo,
            g.nome_grupo,
            a.modalidade
          FROM publicadores p
          LEFT JOIN grupos g ON p.grupo_id = g.id
          LEFT JOIN assistencia_detalhe a ON p.id = a.publicador_id AND a.reuniao_id = $1

          ORDER BY p.nome_completo ASC
        `, [id]);
    };

    let res;
    try {
        res = await queryAssistance();
    } catch (err) {
        if (err.code === '42P01') { // Undefined table
            console.log("Tabela assistencia_detalhe não encontrada. Criando...");
            await client.query('BEGIN');
            // Ensure both tables exist just in case
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
            res = await queryAssistance();
        } else {
            throw err;
        }
    }
    
    return NextResponse.json(res.rows, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar assistência:', err);
    return NextResponse.json({ message: 'Erro interno.', error: err.message, code: err.code, stack: err.stack }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST: Batch update attendance
export async function POST(request, { params }) {
  const { id } = await params;
  const { assistanceData } = await request.json(); // Array of { publicador_id, modalidade }
  
  // modalidade = 'Presencial', 'Zoom', or null (Absent)

  if (!id || !Array.isArray(assistanceData)) {
      return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Strategy: Delete all for this meeting and re-insert checks.
    await client.query('DELETE FROM assistencia_detalhe WHERE reuniao_id = $1', [id]);

    const insertQuery = `
      INSERT INTO assistencia_detalhe (reuniao_id, publicador_id, modalidade)
      VALUES ($1, $2, $3)
    `;

    for (const item of assistanceData) {
        if (item.modalidade) { // Only insert if they are present (Presencial or Zoom)
            await client.query(insertQuery, [id, item.publicador_id, item.modalidade]);
        }
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Assistência salva com sucesso!' }, { status: 200 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar assistência:', err);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  } finally {
    client.release();
  }
}
