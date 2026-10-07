import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { getPublisherAssignments } from '@/app/lib/publisher-assignments';
import { getWeekStart, addDateDays, suggestMechanicalAssignments } from '@/app/lib/mechanical-assignments';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function POST(request) {
    const { semana, reuniao_ids, assignments = [] } = await request.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semana || '') || Number.isNaN(new Date(semana).getTime()) ||
        !Array.isArray(reuniao_ids) || !reuniao_ids.length || !reuniao_ids.every(Number.isInteger) ||
        !Array.isArray(assignments) || assignments.some(a => !Number.isInteger(a?.reuniao_id) || !Number.isInteger(a?.tipo_id) ||
            (a.publicador_id != null && !Number.isInteger(a.publicador_id)))) {
        return NextResponse.json({ message: 'Selecione uma semana e reuniões válidas.' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
        const permissions = await getUserPermissions(client, getUserIdFromRequest(request));
        if (!isAllowed(permissions, 'privilegios_mecanicos_editar', 'actions')) {
            return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
        }
        const start = getWeekStart(semana);
        const [meetingRes, typeRes, publisherRes, history] = await Promise.all([
            client.query(`SELECT id, data, tipo FROM reunioes_registro
                WHERE data >= $1::date AND data < $2::date AND id = ANY($3::int[]) ORDER BY data`,
                [start, addDateDays(start, 7), reuniao_ids]),
            client.query('SELECT * FROM privilegios_tipos WHERE ativo = TRUE ORDER BY ordem, id'),
            client.query(`SELECT p.id, p.nome_completo, p.sexo, p.data_batismo, p.privilegios
                FROM publicadores p LEFT JOIN grupos g ON p.grupo_id = g.id
                WHERE g.id IS NULL OR g.ativo = TRUE`),
            getPublisherAssignments(client)
        ]);
        if (meetingRes.rows.length !== new Set(reuniao_ids).size) {
            return NextResponse.json({ message: 'As reuniões devem pertencer à semana selecionada.' }, { status: 400 });
        }
        const types = new Set(typeRes.rows.map(t => t.id));
        const publishers = new Set(publisherRes.rows.map(p => p.id));
        if (assignments.some(a => !reuniao_ids.includes(a.reuniao_id) || !types.has(a.tipo_id) ||
            (a.publicador_id != null && !publishers.has(a.publicador_id)))) {
            return NextResponse.json({ message: 'Uma designação informada é inválida.' }, { status: 400 });
        }
        return NextResponse.json(suggestMechanicalAssignments({
            meetings: meetingRes.rows, types: typeRes.rows, publishers: publisherRes.rows, history, assignments
        }));
    } catch (error) {
        console.error('Erro ao sugerir privilégios:', error);
        return NextResponse.json({ message: 'Não foi possível gerar as sugestões.' }, { status: 500 });
    } finally {
        client.release();
    }
}
