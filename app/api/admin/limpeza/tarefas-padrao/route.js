import { authorizeRequest } from '@/app/lib/request-authorization';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getUserIdFromRequest, getUserPermissions } from '@/app/lib/server-access';
import { isAllowed } from '@/app/lib/access-control';
import { registerAuditLog } from '@/app/lib/audit-log';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
async function ensureTable(client) {
    await client.query(`CREATE TABLE IF NOT EXISTS limpeza_tarefas_padrao (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        meio_semana TEXT NOT NULL DEFAULT '',
        fim_semana TEXT NOT NULL DEFAULT ''
    )`);
}

export async function GET(request) {
    const denied = await authorizeRequest(request, 'GET');
    if (denied) return denied;
    const client = await pool.connect();
    try {
        await ensureTable(client);
        const result = await client.query('SELECT meio_semana, fim_semana FROM limpeza_tarefas_padrao WHERE id = 1');
        return NextResponse.json(result.rows[0] || { meio_semana: '', fim_semana: '' });
    } catch {
        return NextResponse.json({ message: 'Erro ao carregar tarefas padrão.' }, { status: 500 });
    } finally { client.release(); }
}

export async function PUT(request) {
    const denied = await authorizeRequest(request, 'PUT');
    if (denied) return denied;
    const client = await pool.connect();
    try {
        const userId = getUserIdFromRequest(request);
        const permissions = await getUserPermissions(client, userId);
        if (!isAllowed(permissions, 'limpeza_semanal_editar', 'actions')) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
        const { meio_semana, fim_semana } = await request.json();
        if ([meio_semana, fim_semana].some(value => typeof value !== 'string' || value.length > 20000)) {
            return NextResponse.json({ message: 'Informe textos de até 20.000 caracteres.' }, { status: 400 });
        }
        await ensureTable(client);
        await client.query('BEGIN');
        await client.query(`INSERT INTO limpeza_tarefas_padrao (id, meio_semana, fim_semana) VALUES (1, $1, $2)
            ON CONFLICT (id) DO UPDATE SET meio_semana = EXCLUDED.meio_semana, fim_semana = EXCLUDED.fim_semana`, [meio_semana, fim_semana]);
        await registerAuditLog(client, { userId, action: 'limpeza_tarefas_padrao_salvas', entity: 'limpeza' });
        await client.query('COMMIT');
        return NextResponse.json({ meio_semana, fim_semana });
    } catch {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'Erro ao salvar tarefas padrão.' }, { status: 500 });
    } finally { client.release(); }
}
