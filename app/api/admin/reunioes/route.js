
import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { meetingCancellation } from '@/app/lib/meeting-calendar';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { findVisitInWeek, getVisitTuesday, isSuperintendentVisit } from '@/app/lib/meeting-visits';

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
    const all = url.searchParams.get('all') === '1';
    
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

    if (!year && !month && !all) {
         query += ` LIMIT ${limit ? parseInt(limit) : 20}`; // Default limit 20
    }

    const res = await client.query(query, params);
    
    // Format dates safely and Check Conflicts
    
    // 1. Fetch Context (Config & Events) for conflict detection
    const queryYear = year || new Date().getFullYear();
    
    const [configRes, eventsRes] = await Promise.all([
        all
            ? client.query('SELECT ano, dia_meio_semana, dia_fim_semana FROM configuracoes_gerais')
            : client.query('SELECT ano, dia_meio_semana, dia_fim_semana FROM configuracoes_gerais WHERE ano = $1', [queryYear]),
        // Include adjacent days so a visit at a month/year boundary affects the whole week.
        all ? client.query('SELECT * FROM eventos_especiais') : client.query(`SELECT * FROM eventos_especiais
            WHERE data BETWEEN make_date($1::int, 1, 1) - 7
                AND make_date($1::int, 12, 31) + 7`, [queryYear])
    ]);

    const configs = new Map(configRes.rows.map(c => [String(c.ano || queryYear), c]));
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
        const config = configs.get(dateStr.slice(0, 4));
        const result = {
            ...row,
            data_formatada: meetingDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
            cancelado: false,
            motivo_cancelamento: '',
            evento_nome: '',
            virtual: false
        };

        Object.assign(result, meetingCancellation(row, specialEvents, config));

        return result;
    });

    // 3. Build a set of meeting dates already in DB
    const meetingDateSet = new Set(res.rows.map(r => toDateStr(new Date(r.data))));

    // 4. For each special event, check if it falls on a configured meeting day
    //    and does NOT already have a meeting in DB → insert a virtual row
    if (configs.size) {
        for (const ev of specialEvents) {
            if (isSuperintendentVisit(ev)) continue;
            // The context query also includes events outside the requested period.
            if (!all && String(ev.ano) !== String(queryYear)) continue;
            if (month && ev.dateObj.getUTCMonth() + 1 !== Number(month)) continue;
            if (meetingDateSet.has(ev.dateStr)) continue; // Already has a real meeting
            const config = configs.get(ev.dateStr.slice(0, 4));
            if (!config) continue;
            const midweekDayIdx = daysMap[config.dia_meio_semana];
            const weekendDayIdx = daysMap[config.dia_fim_semana];

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
    const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
    if (!isAllowed(permissions, 'configuracoes_editar', 'actions')) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
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
