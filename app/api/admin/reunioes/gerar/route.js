import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { findVisitInWeek, getVisitTuesday } from '@/app/lib/meeting-visits';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Helper: Get weekday name (Segunda-feira, etc) from date
function getWeekdayName(date) {
    const day = date.getUTCDay(); // 0 = Sunday
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[day];
}

export async function POST(request) {
    const client = await pool.connect();
    try {
        const body = await request.json();
        const { action, period, year, options } = body; 
        
        // NOVO: Tratamento direto para criação de reunião avulsa/personalizada
        if (action === 'create_custom') {
            const { data, tipo } = body;
            
            if (!data || !tipo) {
                return NextResponse.json({ message: 'A data e o tipo são obrigatórios.' }, { status: 400 });
            }

            // Verifica se já existe uma reunião para o dia escolhido para evitar duplicação ou erro crítico
            const verificaExistente = await client.query('SELECT id FROM reunioes_registro WHERE data = $1', [data]);
            if (verificaExistente.rows.length > 0) {
                return NextResponse.json({ message: 'Já existe uma reunião registada nesta data.' }, { status: 400 });
            }

            // Insere diretamente na base de dados
            await client.query(`
                INSERT INTO reunioes_registro (data, tipo) 
                VALUES ($1, $2)
            `, [data, tipo]);

            return NextResponse.json({ message: 'Reunião personalizada criada com sucesso!' }, { status: 201 });
        }


        // LOGICA PADRÃO EM LOTE (Mensal, Trimestral, etc...)
        
        // 1. Fetch Configuration & Events
        const configRes = await client.query('SELECT * FROM configuracoes_gerais WHERE ano = $1', [year]);
        const config = configRes.rows[0];
        
        if (!config || !config.dia_meio_semana || !config.dia_fim_semana) {
            return NextResponse.json({ message: 'Configure os dias de reunião primeiro.' }, { status: 400 });
        }

        const eventsRes = await client.query(`SELECT * FROM eventos_especiais
            WHERE data BETWEEN make_date($1::int, 1, 1) - 7
                AND make_date($1::int, 12, 31) + 7`, [year]);
        const events = eventsRes.rows.map(e => ({
            ...e,
            dateObj: new Date(`${new Date(e.data).toISOString().slice(0, 10)}T00:00:00Z`)
        }));

        // 2. Determine Date Range
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
        // Start from tomorrow to avoid issues with "today"
        let startDate = new Date(`${today}T00:00:00Z`);
        startDate.setUTCDate(startDate.getUTCDate() + 1);
        
        // Adjust start date if we are in a different year context
        if (startDate.getUTCFullYear() < year) {
             startDate = new Date(Date.UTC(year, 0, 1));
        } else if (startDate.getUTCFullYear() > year) {
             return NextResponse.json({ message: 'O ano selecionado já passou.' }, { status: 400 });
        }

        let endDate = new Date(startDate);
        if (period === 'mensal') endDate.setUTCMonth(endDate.getUTCMonth() + 1);
        else if (period === 'trimestral') endDate.setUTCMonth(endDate.getUTCMonth() + 3);
        else if (period === 'semestral') endDate.setUTCMonth(endDate.getUTCMonth() + 6);
        else if (period === 'anual') endDate = new Date(Date.UTC(year, 11, 31));
        
        // Cap at end of year
        if (endDate.getUTCFullYear() > year) endDate = new Date(Date.UTC(year, 11, 31));


        // 3. Simulation Logic
        const proposedMeetings = [];
        const warnings = [];

        let current = new Date(startDate);
        
        // Iterate day by day
        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            const weekday = getWeekdayName(current);
            const eventOnDay = events.find(e => e.dateObj.toISOString().split('T')[0] === dateStr);

            let type = null;
            let skip = false;
            let reason = '';

            // Helper for formatting date to BR standard in warnings
            const formatDateBR = (dateStr) => {
                const [y, m, d] = dateStr.split('-');
                return `${d}-${m}-${y}`;
            };

            // Check if it's a meeting day
            if (weekday === config.dia_meio_semana) type = 'Meio de Semana';
            if (weekday === config.dia_fim_semana) type = 'Fim de Semana';

            const visitInWeek = findVisitInWeek(events, dateStr);
            const visitTuesday = visitInWeek && getVisitTuesday(visitInWeek.data);
            if (visitInWeek && dateStr === visitTuesday) {
                type = 'Meio de Semana';
                reason = 'Reunião de visita na terça-feira';
            }

            if (type) {
                // RULE 1: Special Events on the day itself
                if (eventOnDay) {
                    if (eventOnDay.tipo === 'Celebração') {
                       skip = true;
                       reason = `Celebração neste dia (${eventOnDay.nome})`;
                    } 
                    else if (['Assembleia', 'Congresso'].includes(eventOnDay.tipo)) {
                        skip = true;
                        reason = `${eventOnDay.tipo} neste dia`;
                    }
                }
            }

            // RULE 2: Complex Interactions
            if (type === 'Meio de Semana' && !skip) {
                const startOfWeek = new Date(current);
                startOfWeek.setUTCDate(current.getUTCDate() - (current.getUTCDay() + 6) % 7); // Monday
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6); // Sunday

                const celebracaoInWeek = events.find(e => 
                    e.tipo === 'Celebração' && 
                    e.dateObj >= startOfWeek && e.dateObj <= endOfWeek
                );

                if (celebracaoInWeek) {
                    skip = true;
                    const celDate = celebracaoInWeek.dateObj.toISOString().split('T')[0];
                    reason = `Celebração nesta semana (${formatDateBR(celDate)})`;
                }

                if (!skip) {
                    let nextWeekend = new Date(current);
                    for(let i=1; i<=6; i++) {
                        nextWeekend.setUTCDate(nextWeekend.getUTCDate() + 1);
                        if (getWeekdayName(nextWeekend) === config.dia_fim_semana) break;
                    }
                    
                    const weekendEvent = events.find(e => 
                        e.dateObj.toISOString().split('T')[0] === nextWeekend.toISOString().split('T')[0] &&
                        ['Assembleia', 'Congresso'].includes(e.tipo)
                    );

                    if (weekendEvent) {
                        skip = true;
                        const weDate = weekendEvent.dateObj.toISOString().split('T')[0];
                        reason = `Antecede ${weekendEvent.tipo} no fim de semana (${formatDateBR(weDate)})`;
                    }
                    
                    if (!skip && visitInWeek && dateStr !== visitTuesday) {
                        skip = true;
                        reason = 'Semana de Visita: Reunião movida para Terça-feira';
                    }
                }
            }

            // General Generation logic for Configured Days
            if (type && !skip) {
                proposedMeetings.push({
                    data: dateStr,
                    tipo: type,
                    weekday: weekday,
                    reason: reason || 'Agenda Regular'
                });
                if (visitInWeek && dateStr === visitTuesday) {
                    warnings.push(`Reunião de Visita gerada na Terça-feira (${formatDateBR(dateStr)})`);
                }
            } else if (skip && type) {
                warnings.push(`Reunião de ${type} em ${formatDateBR(dateStr)} pulada: ${reason}`);
            }

            current.setUTCDate(current.getUTCDate() + 1);
        }
        
        // 4. Action Handling
        if (action === 'preview') {
            if (proposedMeetings.length > 0) {
                const dates = proposedMeetings.map(m => m.data);
                const existingRes = await client.query(`SELECT data FROM reunioes_registro WHERE data = ANY($1::date[])`, [dates]);
                const existingDates = new Set(existingRes.rows.map(r => r.data.toISOString().split('T')[0]));
                
                proposedMeetings.forEach(m => {
                    if (existingDates.has(m.data)) m.exists = true;
                });
            }

            return NextResponse.json({ 
                meetings: proposedMeetings, 
                warnings 
            });
        } 
        else if (action === 'create') {
            const { meetings_to_create } = options || {};
            
            if (!meetings_to_create || !Array.isArray(meetings_to_create)) {
                 return NextResponse.json({ message: 'Nenhuma reunião selecionada.' }, { status: 400 });
            }

            let createdCount = 0;
            for (const m of meetings_to_create) {
                try {
                     const visit = m.tipo === 'Meio de Semana' && findVisitInWeek(events, m.data);
                     const meetingDate = visit ? getVisitTuesday(visit.data) : m.data;
                     await client.query(`
                        INSERT INTO reunioes_registro (data, tipo) 
                        VALUES ($1, $2)
                        ON CONFLICT (data) DO NOTHING
                     `, [meetingDate, m.tipo]);
                     createdCount++;
                } catch (e) {
                    console.error("Insert error for " + m.data, e);
                }
            }
            
            return NextResponse.json({ message: `Configuração concluída. ${createdCount} reuniões criadas.` });
        }

        return NextResponse.json({ message: 'Ação inválida.' }, { status: 400 });

    } catch (err) {
        console.error('Erro na geração:', err);
        return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
    } finally {
        client.release();
    }
}
