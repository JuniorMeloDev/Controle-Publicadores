import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import { getWeekStart } from '@/app/lib/mechanical-assignments';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
    const url = new URL(request.url);
    const ids = (url.searchParams.get('reuniao_ids') || url.searchParams.get('reuniao_id') || '')
        .split(',').filter(Boolean).map(Number);
    if (!ids.length) return NextResponse.json([]);
    if (!ids.every(id => Number.isInteger(id) && id > 0)) {
        return NextResponse.json({ message: 'Reuniões inválidas.' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT rp.*, pt.nome AS privilegio_nome, p.nome_completo AS publicador_nome
            FROM reunioes_privilegios rp
            JOIN privilegios_tipos pt ON pt.id = rp.privilegio_tipo_id
            LEFT JOIN publicadores p ON p.id = rp.publicador_id
            WHERE rp.reuniao_id = ANY($1::int[])
        `, [ids]);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar privilégios:', error);
        return NextResponse.json({ message: 'Erro ao buscar atribuições.' }, { status: 500 });
    } finally {
        client.release();
    }
}

const legacyColumns = {
    'Leitor de A Sentinela': 'leitor_id',
    'Indicador Interno': 'indicador_interno_id',
    'Ind. Externo / Volante': 'indicador_externo_volante_id',
    'Indicador Externo': 'indicador_externo_id',
    'Volante': 'volante_id',
    'Ancião de Apoio': 'anciao_apoio_id'
};

export async function POST(request) {
    const body = await request.json();
    // Preserve support for the single-meeting form used elsewhere.
    const meetings = body.reunioes || [{ reuniao_id: body.reuniao_id, assignments: body.assignments }];
    if (!Array.isArray(meetings) || !meetings.length || meetings.some(m =>
        !Number.isInteger(m?.reuniao_id) || m.reuniao_id <= 0 || !Array.isArray(m.assignments) ||
        m.assignments.some(a => !Number.isInteger(a?.tipo_id) || a.tipo_id <= 0 ||
            (a.publicador_id != null && (!Number.isInteger(a.publicador_id) || a.publicador_id <= 0))) ||
        new Set(m.assignments.map(a => a.tipo_id)).size !== m.assignments.length) ||
        new Set(meetings.map(m => m.reuniao_id)).size !== meetings.length) {
        return NextResponse.json({ message: 'Reuniões ou designações inválidas.' }, { status: 400 });
    }
    const client = await pool.connect();
    let transaction = false;
    try {
        const userId = getUserIdFromRequest(request);
        const permissions = await getUserPermissions(client, userId);
        if (!isAllowed(permissions, 'privilegios_mecanicos_editar', 'actions')) {
            return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
        }
        await client.query('BEGIN');
        transaction = true;
        const ids = meetings.map(m => m.reuniao_id);
        const meetingRes = await client.query('SELECT id, data FROM reunioes_registro WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
        const typeRes = await client.query('SELECT id, nome FROM privilegios_tipos');
        const types = new Map(typeRes.rows.map(t => [t.id, t.nome]));
        const publisherIds = meetings.flatMap(m => m.assignments.map(a => a.publicador_id).filter(Boolean));
        const pubRes = await client.query('SELECT id FROM publicadores WHERE id = ANY($1::int[])', [publisherIds]);
        const publishers = new Set(pubRes.rows.map(p => p.id));
        if (meetingRes.rows.length !== ids.length || new Set(meetingRes.rows.map(m => getWeekStart(m.data))).size > 1 ||
            meetings.some(m => m.assignments.some(a => !types.has(a.tipo_id) || (a.publicador_id && !publishers.has(a.publicador_id))))) {
            await client.query('ROLLBACK');
            transaction = false;
            return NextResponse.json({ message: 'Verifique os publicadores, privilégios e a semana selecionada.' }, { status: 400 });
        }
        for (const meeting of meetings) {
            // Preserve types that were not submitted, including inactive types.
            await client.query('DELETE FROM reunioes_privilegios WHERE reuniao_id = $1 AND privilegio_tipo_id = ANY($2::int[])',
                [meeting.reuniao_id, meeting.assignments.map(a => a.tipo_id)]);
            for (const assignment of meeting.assignments) {
                if (assignment.publicador_id) {
                    await client.query(`INSERT INTO reunioes_privilegios (reuniao_id, privilegio_tipo_id, publicador_id)
                        VALUES ($1, $2, $3)`, [meeting.reuniao_id, assignment.tipo_id, assignment.publicador_id]);
                }
                const column = legacyColumns[types.get(assignment.tipo_id)];
                if (column) {
                    await client.query(`UPDATE reunioes_registro SET ${column} = $1 WHERE id = $2`,
                        [assignment.publicador_id || null, meeting.reuniao_id]);
                }
            }
        }
        await registerAuditLog(client, {
            userId, action: 'privilegios_atribuidos', entity: 'reuniao', entityId: ids.join(','),
            details: { reuniao_ids: ids, total: publisherIds.length }
        });
        await client.query('COMMIT');
        transaction = false;
        return NextResponse.json({ message: 'Designações da semana salvas com sucesso.' });
    } catch (error) {
        if (transaction) await client.query('ROLLBACK');
        console.error('Erro ao salvar privilégios:', error);
        return NextResponse.json({ message: 'Erro ao salvar designações.' }, { status: 500 });
    } finally {
        client.release();
    }
}
