
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
    const queryYear = year || new Date().getFullYear();
    
    const [configRes, eventsRes] = await Promise.all([
        client.query('SELECT dia_meio_semana, dia_fim_semana FROM configuracoes_gerais WHERE ano = $1', [queryYear]),
        month
            ? client.query('SELECT * FROM eventos_especiais WHERE ano = $1 AND EXTRACT(MONTH FROM data) = $2', [queryYear, month])
            : client.query('SELECT * FROM eventos_especiais WHERE ano = $1', [queryYear])
    ]);

    const config = configRes.rows[0];
    const specialEvents = eventsRes.rows.map(e => ({
        ...e,
        dateObj: new Date(e.data),
        dateStr: new Date(e.data).toISOString().split('T')[0]
    }));

    // Helper: map day name to UTC day index
    const daysMap = {
        'Domingo': 0, 'Segunda-feira': 1, 'Terça-feira': 2,
        'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6
    };

    // Helper: get ISO date string from a Date in UTC
    const toDateStr = (d) => d.toISOString().split('T')[0];

    // 2. Process existing meetings with conflict logic
    let meetings = res.rows.map(row => {
        const meetingDate = new Date(row.data);
        const dateStr = toDateStr(meetingDate);
        const result = {
            ...row,
            data_formatada: meetingDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
            cancelado: false,
            motivo_cancelamento: '',
            evento_nome: '',
            virtual: false
        };

        if (!config) return result;

        // 1. Exact Day Conflict — any event type on the exact meeting day cancels it
        const eventOnDay = specialEvents.find(e => e.dateStr === dateStr);
        if (eventOnDay) {
            result.cancelado = true;
            result.motivo_cancelamento = `${eventOnDay.tipo}: ${eventOnDay.nome}`;
            result.evento_nome = eventOnDay.nome;
        }

        // 2. Complex Rules for Midweek meetings (only if not already cancelled)
        if (!result.cancelado && row.tipo === 'Meio de Semana') {
            const current = new Date(meetingDate);
            const startOfWeek = new Date(current);
            startOfWeek.setDate(current.getUTCDate() - current.getUTCDay() + 1); // Monday
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getUTCDate() + 6); // Sunday

            // 2a. Check for Celebração in the same week
            const celInWeek = specialEvents.find(e =>
                e.tipo === 'Celebração' &&
                e.dateObj >= startOfWeek && e.dateObj <= endOfWeek
            );
            if (celInWeek) {
                result.cancelado = true;
                result.motivo_cancelamento = `Celebração na semana: ${celInWeek.nome} (${celInWeek.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`;
                result.evento_nome = celInWeek.nome;
            }

            // 2b. Check for Assembleia/Congresso on the weekend of the SAME week
            if (!result.cancelado) {
                const assemblyInWeek = specialEvents.find(e =>
                    ['Assembleia', 'Congresso'].includes(e.tipo) &&
                    e.dateObj >= startOfWeek && e.dateObj <= endOfWeek
                );
                if (assemblyInWeek) {
                    result.cancelado = true;
                    result.motivo_cancelamento = `${assemblyInWeek.tipo}: ${assemblyInWeek.nome} (${assemblyInWeek.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`;
                    result.evento_nome = assemblyInWeek.nome;
                }
            }

            // 2c. Check for Assembly/Congress on UPCOMING weekend of next week (Antecede)
            if (!result.cancelado) {
                const targetDayIdx = daysMap[config.dia_fim_semana];
                if (targetDayIdx !== undefined) {
                    for (let i = 1; i <= 6; i++) {
                        const d = new Date(current);
                        d.setDate(d.getUTCDate() + i);
                        if (d.getUTCDay() === targetDayIdx) {
                            const dateStrWe = toDateStr(d);
                            const weekendEvent = specialEvents.find(e =>
                                e.dateStr === dateStrWe &&
                                ['Assembleia', 'Congresso'].includes(e.tipo)
                            );
                            if (weekendEvent) {
                                result.cancelado = true;
                                result.motivo_cancelamento = `Antecede ${weekendEvent.tipo}: ${weekendEvent.nome} (${weekendEvent.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`;
                                result.evento_nome = weekendEvent.nome;
                            }
                            break;
                        }
                    }
                }
            }
        }

        return result;
    });

    // 3. Build a set of meeting dates already in DB
    const meetingDateSet = new Set(res.rows.map(r => toDateStr(new Date(r.data))));

    // 4. For each special event, check if it falls on a configured meeting day
    //    and does NOT already have a meeting in DB → insert a virtual row
    if (config) {
        const midweekDayIdx = daysMap[config.dia_meio_semana];
        const weekendDayIdx = daysMap[config.dia_fim_semana];

        for (const ev of specialEvents) {
            if (meetingDateSet.has(ev.dateStr)) continue; // Already has a real meeting

            const dayOfWeek = ev.dateObj.getUTCDay();
            let meetingType = null;

            if (dayOfWeek === midweekDayIdx) {
                meetingType = 'Meio de Semana';
            } else if (dayOfWeek === weekendDayIdx) {
                meetingType = 'Fim de Semana';
            } else {
                // Also check: is this a Celebração that cancels the same week's midweek?
                // If so, we inject a virtual row for the MIDWEEK day of that week
                if (ev.tipo === 'Celebração' && midweekDayIdx !== undefined) {
                    // Find the midweek day of this event's week
                    const evDay = new Date(ev.dateObj);
                    const evDayOfWeek = evDay.getUTCDay();
                    const diffToMonday = evDayOfWeek === 0 ? -6 : 1 - evDayOfWeek;
                    const monday = new Date(evDay);
                    monday.setDate(evDay.getUTCDate() + diffToMonday);
                    
                    // Find the midweek day of this week
                    const diffToMidweek = (midweekDayIdx - 1 + 7) % 7; // from Monday
                    const midweekOfWeek = new Date(monday);
                    midweekOfWeek.setDate(monday.getUTCDate() + diffToMidweek);
                    const midweekStr = toDateStr(midweekOfWeek);
                    
                    if (!meetingDateSet.has(midweekStr)) {
                        meetings.push({
                            id: null,
                            virtual: true,
                            data: midweekOfWeek,
                            data_formatada: midweekOfWeek.toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                            tipo: 'Meio de Semana',
                            cancelado: true,
                            motivo_cancelamento: `Celebração na semana: ${ev.nome} (${ev.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`,
                            evento_nome: ev.nome,
                            presencial: 0, zoom: 0, visitantes: 0, total: 0
                        });
                        meetingDateSet.add(midweekStr);
                    }
                }
                continue; // Event on a non-meeting day
            }

            // Inject virtual meeting row for this event
            meetings.push({
                id: null,
                virtual: true,
                data: ev.dateObj,
                data_formatada: ev.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                tipo: meetingType,
                cancelado: true,
                motivo_cancelamento: `${ev.tipo}: ${ev.nome}`,
                evento_nome: ev.nome,
                presencial: 0, zoom: 0, visitantes: 0, total: 0
            });

            // Se for Assembleia/Congresso no fim de semana, também cancela/injeta o meio de semana da mesma semana
            if (['Assembleia', 'Congresso'].includes(ev.tipo) && meetingType === 'Fim de Semana' && midweekDayIdx !== undefined) {
                // Calcular o dia de meio de semana dessa mesma semana (semana começa na Segunda)
                const evDay = new Date(ev.dateObj);
                const evDayOfWeek = evDay.getUTCDay();
                const diffToMonday = evDayOfWeek === 0 ? -6 : 1 - evDayOfWeek;
                const monday = new Date(evDay);
                monday.setDate(evDay.getUTCDate() + diffToMonday);
                const diffToMidweek = (midweekDayIdx - 1 + 7) % 7; // from Monday
                const midweekOfWeek = new Date(monday);
                midweekOfWeek.setDate(monday.getUTCDate() + diffToMidweek);
                const midweekStr = toDateStr(midweekOfWeek);

                if (!meetingDateSet.has(midweekStr)) {
                    // Não há reunião no DB para esse dia — injeta linha virtual
                    meetings.push({
                        id: null,
                        virtual: true,
                        data: midweekOfWeek,
                        data_formatada: midweekOfWeek.toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                        tipo: 'Meio de Semana',
                        cancelado: true,
                        motivo_cancelamento: `${ev.tipo}: ${ev.nome} (${ev.dateObj.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit'})})`,
                        evento_nome: ev.nome,
                        presencial: 0, zoom: 0, visitantes: 0, total: 0
                    });
                    meetingDateSet.add(midweekStr);
                }
                // Se já tem reunião no DB (meetingDateSet.has), a lógica do step 2b já a cancelou
            }
        }
    }

    // 5. Sort by date ascending
    meetings.sort((a, b) => new Date(a.data) - new Date(b.data));

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
