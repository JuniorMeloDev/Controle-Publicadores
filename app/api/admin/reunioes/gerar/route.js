import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Helper: Add days to a date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Helper: Get weekday name (Segunda-feira, etc) from date
function getWeekdayName(date) {
    const day = date.getDay(); // 0 = Sunday
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[day];
}

export async function POST(request) {
    const client = await pool.connect();
    try {
        const body = await request.json();
        const { action, period, year, options } = body; 
        // action: 'preview' or 'create'
        // period: 'mensal', 'trimestral', 'semestral', 'anual'
        // year: 2025
        // options: { meetings_to_create: [...] } (only for 'create')

        // 1. Fetch Configuration & Events
        const configRes = await client.query('SELECT * FROM configuracoes_gerais WHERE ano = $1', [year]);
        const config = configRes.rows[0];
        
        if (!config || !config.dia_meio_semana || !config.dia_fim_semana) {
            return NextResponse.json({ message: 'Configure os dias de reunião primeiro.' }, { status: 400 });
        }

        const eventsRes = await client.query('SELECT * FROM eventos_especiais WHERE ano = $1', [year]);
        const events = eventsRes.rows.map(e => ({
            ...e,
            dateObj: new Date(e.data) // Pre-parse for easier comparison
        }));

        // 2. Determine Date Range
        const now = new Date();
        // Start from tomorrow to avoid issues with "today"
        let startDate = new Date(now);
        startDate.setDate(startDate.getDate() + 1); 
        
        // Adjust start date if we are in a different year context (not likely based on requirements, but good safety)
        if (startDate.getFullYear() < year) {
             startDate = new Date(year, 0, 1);
        } else if (startDate.getFullYear() > year) {
             return NextResponse.json({ message: 'O ano selecionado já passou.' }, { status: 400 });
        }

        let endDate = new Date(startDate);
        if (period === 'mensal') endDate.setMonth(endDate.getMonth() + 1);
        else if (period === 'trimestral') endDate.setMonth(endDate.getMonth() + 3);
        else if (period === 'semestral') endDate.setMonth(endDate.getMonth() + 6);
        else if (period === 'anual') endDate = new Date(year, 11, 31);
        
        // Cap at end of year
        if (endDate.getFullYear() > year) endDate = new Date(year, 11, 31);


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

            // Check if it's a meeting day
            if (weekday === config.dia_meio_semana) type = 'Meio de Semana';
            if (weekday === config.dia_fim_semana) type = 'Fim de Semana';

            if (type) {
                // RULE 1: Special Events on the day itself
                if (eventOnDay) {
                    // Memorial handling
                    if (eventOnDay.tipo === 'Memorial') {
                       // Cancels the meeting of that specific day
                       skip = true;
                       reason = `Memorial neste dia (${eventOnDay.nome})`;
                    } 
                    // Assemblies/Congresses always cancel the specific day meeting if it coincides
                    else if (['Assembleia', 'Congresso'].includes(eventOnDay.tipo)) {
                        skip = true;
                        reason = `${eventOnDay.tipo} neste dia`;
                    }
                    // Visit handling - Handled separately logic below?
                }
            }


            // RULE 2: Complex Interactions (Weekend Assembly cancels preceding Midweek)
            // If today is Midweek, check for upcoming Weekend events
            if (type === 'Meio de Semana' && !skip) {
                // Find next Weekend meeting date
                // Simple heuristic: look ahead up to 6 days for the configured weekend day
                let nextWeekend = new Date(current);
                for(let i=1; i<=6; i++) {
                    nextWeekend.setDate(nextWeekend.getDate() + 1);
                    if (getWeekdayName(nextWeekend) === config.dia_fim_semana) break;
                }
                
                // Check if there is an Assembly/Congress on that weekend date
                const weekendEvent = events.find(e => 
                    e.dateObj.toISOString().split('T')[0] === nextWeekend.toISOString().split('T')[0] &&
                    ['Assembleia', 'Congresso'].includes(e.tipo)
                );

                if (weekendEvent) {
                    skip = true;
                    reason = `Antecede ${weekendEvent.tipo} no fim de semana (${weekendEvent.data.toISOString().split('T')[0]})`;
                }
                
                // Check if VISIT is this week (Visit forces midweek to TUESDAY)
                // We need to know if "current" is Tuesday. If not, and there is a visit, we might skip/move.
                // Actually the rule is: "se for visita ... a reuniao de meio de semana deve sempre ser na terça feira"
                // So if today is NOT Tuesday, but it is the Midweek day (e.g. Wednesday), and there is a Visit this week...
                // Ideally we find the "Visit" event for this week.
                // Let's assume Visit event is registered on the TUESDAY of that week? Or the Visit is a week-long range?
                // Usually Visit is registered as a "Visita do Superintendente" event on a specific date (Start of week? Or just an event?)
                // USER SAID: "se for um visita do superitendente a reuniao do meio de semana deve sempre ser na terça feira"
                // Implementation: Check if there is a 'Visita do Superintendente' in the same week (Mon-Sun).
                // If so, ONLY generate a meeting if today is Tuesday.
                
                const startOfWeek = new Date(current);
                startOfWeek.setDate(current.getDate() - current.getDay() + 1); // Monday
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
                
                const visitInWeek = events.find(e => 
                    e.tipo === 'Visita do Superintendente' && 
                    e.dateObj >= startOfWeek && e.dateObj <= endOfWeek
                );

                if (visitInWeek) {
                    if (weekday !== 'Terça-feira') {
                        skip = true;
                        reason = `Semana de Visita: Reunião movida para Terça-feira`;
                        // But we also need to CREATE the Tuesday meeting if it's not the configured day
                        // This logic parses "configured days". If configured is Wed, skip Wed.
                        // We need a separate pass or logic to "Push" a Tuesday meeting?
                        // Let's stick to: If Configured Day != Tuesday, skip. 
                        // AND we need to inject a Tuesday meeting if Configured Day != Tuesday.
                    }
                }
            }

             // RULE 3: Visit injection (if configured day is NOT Tuesday)
             // Check if today is Tuesday, and Configured Day is NOT Tuesday.
             if (weekday === 'Terça-feira' && config.dia_meio_semana !== 'Terça-feira') {
                 // Check for visit in this week
                const startOfWeek = new Date(current);
                startOfWeek.setDate(current.getDate() - current.getDay() + 1);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);

                const visitInWeek = events.find(e => 
                    e.tipo === 'Visita do Superintendente' && 
                    e.dateObj >= startOfWeek && e.dateObj <= endOfWeek
                );

                if (visitInWeek) {
                    // Force create extra/moved meeting
                    if (!proposedMeetings.find(m => m.data === dateStr)) { // Avoid dupes
                         proposedMeetings.push({
                            data: dateStr,
                            tipo: 'Meio de Semana',
                            weekday: 'Terça-feira',
                            reason: 'Reunião de Visita (Forçada na Terça)'
                        });
                        warnings.push(`Reunião de Visita gerada excepcionalmente na Terça-feira (${dateStr})`);
                    }
                }
             }

            // General Generation logic for Configured Days
            if (type && !skip) {
                // Check database if exists (Only for preview? Or just rely on unique constraint later?)
                // For preview, we assume if it's in the list it's new.
                // Ideally we shouldn't create if already exists in DB. 
                // Let's check DB existence in bulk efficiently? Or just iterate.
                // For now, let's propose it. The "Confirm" step will handle DB inserts.
                proposedMeetings.push({
                    data: dateStr,
                    tipo: type,
                    weekday: weekday,
                    reason: 'Agenda Regular'
                });
            } else if (skip && type) {
                warnings.push(`Reunião de ${type} em ${dateStr} pulada: ${reason}`);
            }

            current.setDate(current.getDate() + 1);
        }
        
        // 4. Action Handling
        if (action === 'preview') {
            // Check existing in DB to mark as "Already Exists"
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
            const { meetings_to_create } = options; 
            // Expects array of objects { data, tipo }
            
            if (!meetings_to_create || !Array.isArray(meetings_to_create)) {
                 return NextResponse.json({ message: 'Nenhuma reunião selecionada.' }, { status: 400 });
            }

            let createdCount = 0;
            for (const m of meetings_to_create) {
                try {
                     await client.query(`
                        INSERT INTO reunioes_registro (data, tipo) 
                        VALUES ($1, $2)
                        ON CONFLICT (data) DO NOTHING
                     `, [m.data, m.tipo]);
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
