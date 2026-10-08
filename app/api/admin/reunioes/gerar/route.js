import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { findVisitInWeek, getVisitTuesday } from '@/app/lib/meeting-visits';
import { dateOnly, generationRange, isCalendarDate, meetingCancellation } from '@/app/lib/meeting-calendar';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';

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
        const { action, period = 'mensal', year, month, options } = body;
        const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
        if (!isAllowed(permissions, 'configuracoes_editar', 'actions')) {
            return NextResponse.json({ message: 'Você não tem permissão para criar reuniões.' }, { status: 403 });
        }
        
        // NOVO: Tratamento direto para criação de reunião avulsa/personalizada
        if (action === 'create_custom') {
            const { data, tipo } = body;
            
            if (!isCalendarDate(data) || !['Meio de Semana', 'Fim de Semana'].includes(tipo)) {
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

            return NextResponse.json({ message: 'Reunião criada e disponível nas abas de designações.' }, { status: 201 });
        }


        // LOGICA PADRÃO EM LOTE (Mensal, Trimestral, etc...)
        
        // 1. Fetch Configuration & Events
        const configRes = await client.query('SELECT * FROM configuracoes_gerais WHERE ano BETWEEN $1::int AND $1::int + 1', [year]);
        const configs = new Map(configRes.rows.map(c => [String(c.ano || year), c]));
        let config = configs.get(String(year));
        
        if (!config || !config.dia_meio_semana || !config.dia_fim_semana) {
            return NextResponse.json({ message: 'Configure os dias de reunião primeiro.' }, { status: 400 });
        }

        const eventsRes = await client.query(`SELECT * FROM eventos_especiais
            WHERE data BETWEEN make_date($1::int, 1, 1) - 7
                AND make_date($1::int + 1, 12, 31) + 7`, [year]);
        const events = eventsRes.rows.map(e => ({
            ...e,
            dateObj: new Date(`${new Date(e.data).toISOString().slice(0, 10)}T00:00:00Z`)
        }));

        if (action === 'create') {
            const selected = options?.meetings_to_create;
            if (!Array.isArray(selected) || !selected.length || selected.length > 500 ||
                selected.some(m => !isCalendarDate(m.data) || !['Meio de Semana', 'Fim de Semana'].includes(m.tipo))) {
                return NextResponse.json({ message: 'Selecione reuniões com datas e tipos válidos.' }, { status: 400 });
            }
            await client.query('BEGIN');
            let created = 0;
            let existing = 0;
            const totals = { meio_semana: 0, fim_semana: 0 };
            for (const m of selected) {
                const visit = m.tipo === 'Meio de Semana' && findVisitInWeek(events, m.data);
                const data = visit ? getVisitTuesday(visit.data) : m.data;
                const meetingConfig = configs.get(data.slice(0, 4));
                if (!meetingConfig) throw new Error(`Configure os dias de reunião de ${data.slice(0, 4)} antes de gerar.`);
                if (meetingCancellation({ ...m, data }, events, meetingConfig).cancelado) throw new Error(`A reunião de ${data} conflita com um evento especial. Gere a prévia novamente.`);
                const result = await client.query(`INSERT INTO reunioes_registro (data, tipo)
                    VALUES ($1, $2) ON CONFLICT (data) DO NOTHING RETURNING id`, [data, m.tipo]);
                if (result.rowCount) {
                    created++;
                    totals[m.tipo === 'Meio de Semana' ? 'meio_semana' : 'fim_semana']++;
                } else existing++;
            }
            await client.query('COMMIT');
            return NextResponse.json({ message: `${created} reuniões criadas e disponíveis nas designações. ${existing} já existentes preservadas.`, created, existing, totals });
        }

        // 2. Determine Date Range
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
        const range = generationRange({ period, year, month, today });
        const startDate = new Date(`${range.start}T00:00:00Z`);
        const endDate = new Date(`${range.end}T00:00:00Z`);

        // 3. Simulation Logic
        const proposedMeetings = [];
        const warnings = [];

        let current = new Date(startDate);
        
        // Iterate day by day
        while (current <= endDate) {
            const dateStr = dateOnly(current);
            config = configs.get(dateStr.slice(0, 4));
            if (!config?.dia_meio_semana || !config?.dia_fim_semana) throw new Error(`Configure os dias de reuni\u00e3o de ${dateStr.slice(0, 4)} antes de gerar.`);
            const weekday = getWeekdayName(current);
            let type = null;
            if (weekday === config.dia_meio_semana) type = 'Meio de Semana';
            if (weekday === config.dia_fim_semana) type = 'Fim de Semana';
            const visit = findVisitInWeek(events, dateStr);
            if (visit && dateStr === getVisitTuesday(visit.data)) type = 'Meio de Semana';
            if (type) {
                const state = meetingCancellation({ data: dateStr, tipo: type }, events, config);
                if (state.cancelado) warnings.push(`${dateStr}: ${state.motivo_cancelamento}`);
                else proposedMeetings.push({ data: dateStr, tipo: type, weekday,
                    reason: visit && type === 'Meio de Semana' ? 'Reuni\u00e3o de visita na ter\u00e7a-feira' : 'Agenda Regular' });
            }

            current.setUTCDate(current.getUTCDate() + 1);
        }
        
        // 4. Action Handling
        if (action === 'preview') {
            if (proposedMeetings.length > 0) {
                const dates = proposedMeetings.map(m => m.data);
                const existingRes = await client.query(`SELECT data FROM reunioes_registro WHERE data = ANY($1::date[])`, [dates]);
                const existingDates = new Set(existingRes.rows.map(r => dateOnly(r.data)));
                
                proposedMeetings.forEach(m => {
                    if (existingDates.has(m.data)) m.exists = true;
                });
            }

            return NextResponse.json({ 
                meetings: proposedMeetings, 
                warnings 
            });
        } 

        return NextResponse.json({ message: 'Ação inválida.' }, { status: 400 });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro na geração:', err);
        return NextResponse.json({ message: err.code ? 'Erro interno.' : err.message }, { status: err.code ? 500 : 400 });
    } finally {
        client.release();
    }
}
