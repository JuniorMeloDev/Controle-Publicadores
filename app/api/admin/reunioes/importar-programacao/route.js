import { NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';
import { lockAssignmentMeeting } from '@/app/lib/meeting-calendar-service';
import { fetchWeeklyProgram } from '@/app/lib/jw-program';
import { importMeetingProgram } from '@/app/lib/jw-program-service';

export const maxDuration = 60;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function POST(request) {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ message: 'Sua sessão expirou ou não está válida. Entre novamente.' }, { status: 401 });
    const client = await pool.connect();
    try {
        const permissions = await getUserPermissions(client, userId);
        if (!isAllowed(permissions, 'designacoes_importar', 'actions') && !isAllowed(permissions, 'configuracoes_editar', 'actions')) {
            return NextResponse.json({ message: 'Você não tem permissão para importar programações.' }, { status: 403 });
        }
        const { reuniao_id } = await request.json();
        if (!Number.isSafeInteger(Number(reuniao_id)) || Number(reuniao_id) <= 0) return NextResponse.json({ message: 'Reunião inválida.' }, { status: 400 });
        const result = await importMeetingProgram(client, reuniao_id, { lockMeeting: lockAssignmentMeeting,
            fetchProgram: fetchWeeklyProgram, audit: registerAuditLog, userId });
        return NextResponse.json(result);
    } catch (error) {
        console.error('Falha ao importar programação:', error.message);
        return NextResponse.json({ status: 'pending', message: error.code ? 'Não foi possível salvar a programação.' : error.message }, { status: 422 });
    } finally { client.release(); }
}
