
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Helper to ensure columns exist
async function ensureColumns(client) {
    const columns = [
        'leitor_id', 
        'indicador_interno_id', 
        'indicador_externo_volante_id', 
        'indicador_externo_id', 
        'volante_id', 
        'anciao_apoio_id',
        'visitantes'
    ];
    
    for (const col of columns) {
        try {
            if (col === 'visitantes') {
                await client.query(`ALTER TABLE reunioes_registro ADD COLUMN IF NOT EXISTS ${col} INTEGER DEFAULT 0`);
            } else {
                // For other columns (which are foreign keys)
                await client.query(`ALTER TABLE reunioes_registro ADD COLUMN IF NOT EXISTS ${col} INTEGER`);
                // Add foreign key constraint if it's an _id column
                if (col.endsWith('_id')) {
                    // Use a separate ALTER TABLE for constraint to avoid issues if column already exists
                    await client.query(`
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_${col}' AND conrelid = 'reunioes_registro'::regclass) THEN
                                ALTER TABLE reunioes_registro ADD CONSTRAINT fk_${col} FOREIGN KEY (${col}) REFERENCES publicadores(id) ON DELETE SET NULL;
                            END IF;
                        END
                        $$;
                    `).catch(() => {}); // Catch potential errors if constraint already exists or other issues
                }
            }
        } catch (e) {
            // Check if error is because column exists (older postgres might not support IF NOT EXISTS in ADD COLUMN)
            // But Neon is likely modern. Ignore safe errors.
            // console.log(`Column check ${col}:`, e.message);
        }
    }
}

// GET: List recent meetings with summary
export async function GET(request) {
  const client = await pool.connect();
  try {
    // 1. Ensure Table and Columns
    try {
         await client.query(`
            CREATE TABLE IF NOT EXISTS reunioes_registro (
                id SERIAL PRIMARY KEY,
                data DATE NOT NULL UNIQUE,
                tipo VARCHAR(50) NOT NULL,
                observacoes TEXT,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
         `);
         await ensureColumns(client);
    } catch (e) { console.error("Migration error:", e); }

    // 2. Query
    // 2. Build Query
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const year = url.searchParams.get('year');
    
    let query = `
      SELECT 
        r.*,
        COUNT(CASE WHEN a.modalidade = 'Presencial' THEN 1 END)::int as presencial,
        COUNT(CASE WHEN a.modalidade = 'Zoom' THEN 1 END)::int as zoom,
        (COUNT(a.id)::int + COALESCE(r.visitantes, 0)) as total
      FROM reunioes_registro r
      LEFT JOIN assistencia_detalhe a ON r.id = a.reuniao_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (year) {
        conditions.push(`EXTRACT(YEAR FROM r.data) = $${params.length + 1}`);
        params.push(year);
    }
    
    if (month) {
        conditions.push(`EXTRACT(MONTH FROM r.data) = $${params.length + 1}`);
        params.push(month);
    }
    
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += `
      GROUP BY r.id
      ORDER BY r.data DESC
    `;
    
    if (!year && !month) {
         query += ' LIMIT 20'; // Default limit if no filter
    }

    const res = await client.query(query, params);
    
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
    const body = await request.json();
    const { 
        data, tipo, 
        leitor_id, 
        indicador_interno_id, 
        indicador_externo_volante_id, 
        indicador_externo_id, 
        volante_id, 
        anciao_apoio_id 
    } = body;
    
    if (!data || !tipo) {
        return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });
    }

    const res = await client.query(`
      INSERT INTO reunioes_registro (
          data, tipo, 
          leitor_id, indicador_interno_id, indicador_externo_volante_id, 
          indicador_externo_id, volante_id, anciao_apoio_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, data, tipo
    `, [
        data, tipo, 
        leitor_id || null, 
        indicador_interno_id || null, 
        indicador_externo_volante_id || null, 
        indicador_externo_id || null, 
        volante_id || null, 
        anciao_apoio_id || null
    ]);

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
