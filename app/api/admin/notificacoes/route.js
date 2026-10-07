import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { getPersonalNotifications } from '@/app/lib/alert-service';
import { todayInBrazil } from '@/app/lib/alerts';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function handle(request, markRead) {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    const client = await pool.connect();
    try {
        const notifications = await getPersonalNotifications(client, userId, todayInBrazil());
        if (markRead) {
            const body = await request.json();
            if (!Array.isArray(body.ids) || body.ids.length > 500 || body.ids.some(id => typeof id !== 'string')) {
                return NextResponse.json({ message: 'Notificações inválidas.' }, { status: 400 });
            }
            const allowed = new Set(body.ids);
            const ids = notifications.filter(n => allowed.has(n.id)).map(n => n.id);
            if (ids.length) await client.query(`INSERT INTO alertas_lidos (publicador_id, notificacao_id)
                SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [userId, ids]);
            notifications.forEach(n => { if (ids.includes(n.id)) n.read = true; });
        }
        return NextResponse.json({ notifications, unread: notifications.filter(n => !n.read).length }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof SyntaxError) return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
        console.error('Falha ao carregar notificações:', error.message);
        return NextResponse.json({ message: 'Não foi possível carregar as notificações.' }, { status: 500 });
    } finally { client.release(); }
}

export async function GET(request) { return handle(request, false); }
export async function POST(request) { return handle(request, true); }
