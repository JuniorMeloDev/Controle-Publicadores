
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
    // 1. Ensure Tables
    try {
        // Main Meeting Table
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

         // Dynamic Privileges Tables
         await client.query(`
            CREATE TABLE IF NOT EXISTS privilegios_tipos (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                ativo BOOLEAN DEFAULT TRUE,
                ordem INTEGER DEFAULT 0
            );
         `);
         
         await client.query(`
            CREATE TABLE IF NOT EXISTS reunioes_privilegios (
                id SERIAL PRIMARY KEY,
                reuniao_id INTEGER REFERENCES reunioes_registro(id) ON DELETE CASCADE,
                privilegio_tipo_id INTEGER REFERENCES privilegios_tipos(id) ON DELETE CASCADE,
                publicador_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
                UNIQUE(reuniao_id, privilegio_tipo_id)
            );
         `);

         // Seed default types if empty
         const typesCheck = await client.query('SELECT COUNT(*) FROM privilegios_tipos');
         if (parseInt(typesCheck.rows[0].count) === 0) {
             const defaults = [
                 'Leitor de A Sentinela', 
                 'Indicador Interno', 
                 'Ind. Externo / Volante',
                 'Indicador Externo', 
                 'Volante', 
                 'Ancião de Apoio'
             ];
             for (let i = 0; i < defaults.length; i++) {
                 await client.query('INSERT INTO privilegios_tipos (nome, ordem) VALUES ($1, $2)', [defaults[i], i]);
             }
         }

         // Migration: If assignments empty but meetings exist, copy from columns
         const assignCheck = await client.query('SELECT COUNT(*) FROM reunioes_privilegios');
         if (parseInt(assignCheck.rows[0].count) === 0) {
             const meetingsRes = await client.query('SELECT * FROM reunioes_registro');
             if (meetingsRes.rows.length > 0) {
                 const typesRes = await client.query('SELECT id, nome FROM privilegios_tipos');
                 const typesMap = {}; // nome -> id
                 typesRes.rows.forEach(t => typesMap[t.nome] = t.id);

                 const colMap = {
                     'leitor_id': 'Leitor de A Sentinela',
                     'indicador_interno_id': 'Indicador Interno',
                     'indicador_externo_volante_id': 'Ind. Externo / Volante',
                     'indicador_externo_id': 'Indicador Externo',
                     'volante_id': 'Volante',
                     'anciao_apoio_id': 'Ancião de Apoio'
                 };

                 for (const m of meetingsRes.rows) {
                     for (const [col, typeName] of Object.entries(colMap)) {
                         if (m[col] && typesMap[typeName]) {
                             // Check for duplicates just in case
                             await client.query(`
                                INSERT INTO reunioes_privilegios (reuniao_id, privilegio_tipo_id, publicador_id)
                                VALUES ($1, $2, $3)
                                ON CONFLICT DO NOTHING
                             `, [m.id, typesMap[typeName], m[col]]);
                         }
                     }
                 }
                 console.log(`Migrated privileges for ${meetingsRes.rows.length} meetings.`);
             }
         }

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
    
    const limit = url.searchParams.get('limit');

    if (!year && !month) {
         query += ` LIMIT ${limit ? parseInt(limit) : 20}`; // Default limit 20
    }

    const res = await client.query(query, params);
    
    // Format dates safely and Check Conflicts
    
    // 1. Fetch Context (Config & Events) for conflict detection
    // Optimization: Only if we have some meetings found
    let meetings = [];
    if (res.rows.length > 0) {
        // Assume all meetings are roughly same year context, or use the query year
        const queryYear = year || new Date().getFullYear();
        
        const [configRes, eventsRes] = await Promise.all([
            client.query('SELECT dia_meio_semana, dia_fim_semana FROM configuracoes_gerais WHERE ano = $1', [queryYear]),
            client.query('SELECT * FROM eventos_especiais WHERE ano = $1', [queryYear])
        ]);

        const config = configRes.rows[0];
        const events = eventsRes.rows.map(e => ({...e, dateObj: new Date(e.data)}));

        meetings = res.rows.map(row => {
            const meetingDate = new Date(row.data);
            const dateStr = meetingDate.toISOString().split('T')[0];
            const result = {
                ...row,
                data_formatada: meetingDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                cancelado: false,
                motivo_cancelamento: ''
            };

            if (!config) return result; // Safety

            // Conflict Logic (Mirrors Generator Logic)
            
            // 1. Exact Day Conflict (Assemblies, Congress, Celebration)
            const eventOnDay = events.find(e => e.dateObj.toISOString().split('T')[0] === dateStr);
            if (eventOnDay) {
                if (['Assembleia', 'Congresso', 'Celebração', 'Memorial'].includes(eventOnDay.tipo)) {
                    result.cancelado = true;
                    result.motivo_cancelamento = `${eventOnDay.tipo} neste dia`;
                }
            }

            // 2. Complex Rules for Midweek
            // We assume 'Meio de Semana' type is stored in DB row.tipo, or we deduce from config days?
            // The DB stores 'Meio de Semana' or 'Fim de Semana'.
            if (!result.cancelado && row.tipo === 'Meio de Semana') {
                
                // 2a. Check for Celebração in the same week
                const current = new Date(meetingDate);
                const startOfWeek = new Date(current);
                startOfWeek.setDate(current.getUTCDate() - current.getUTCDay() + 1); // Monday
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getUTCDate() + 6); // Sunday

                const celInWeek = events.find(e => 
                    e.tipo === 'Celebração' && 
                    e.dateObj >= startOfWeek && e.dateObj <= endOfWeek
                );
                
                if (celInWeek) {
                    result.cancelado = true;
                    result.motivo_cancelamento = `Celebração na semana (${celInWeek.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`;
                }

                // 2b. Check for Assembly on UPCOMING weekend (Antecede Assembleia)
                if (!result.cancelado) {
                    let nextWeekend = new Date(current);
                    // Look ahead for the configured weekend day
                    // Simple heuristic: check next 6 days for config.dia_fim_semana
                    // Map weekday name to index for comparison?
                    // Let's iterate day by day up to 6 days
                    const daysMap = {'Domingo': 0, 'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6};
                    const targetDayIdx = daysMap[config.dia_fim_semana];
                    
                    if (targetDayIdx !== undefined) {
                         for(let i=1; i<=6; i++) {
                            const d = new Date(current);
                            d.setDate(d.getUTCDate() + i);
                            if (d.getUTCDay() === targetDayIdx) {
                                // Found the weekend meeting day. Check for Assembly.
                                const dateStrWe = d.toISOString().split('T')[0];
                                const weekendEvent = events.find(e => 
                                    e.dateObj.toISOString().split('T')[0] === dateStrWe &&
                                    ['Assembleia', 'Congresso'].includes(e.tipo)
                                );
                                if (weekendEvent) {
                                    result.cancelado = true;
                                    result.motivo_cancelamento = `Antecede ${weekendEvent.tipo} (${weekendEvent.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`;
                                }
                                break; 
                            }
                         }
                    }
                }
            }

            return result;
        });
    }

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
