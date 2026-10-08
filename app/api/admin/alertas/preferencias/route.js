import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/app/lib/server-access';
import { getAlertSettings } from '@/app/lib/alert-service';

export const dynamic = 'force-dynamic';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function handle(request, save) {
    const userId = getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    let preference;
    if (save) {
        try {
            const body = await request.json();
            if (typeof body?.emailRemindersEnabled !== 'boolean') throw new Error('invalid');
            preference = body.emailRemindersEnabled;
        } catch { return NextResponse.json({ message: 'Preferência inválida.' }, { status: 400 }); }
    }
    const client = await pool.connect();
    try {
        const settings = await getAlertSettings(client);
        if (save) await client.query(`INSERT INTO alertas_preferencias (publicador_id, email_designacoes)
            VALUES ($1, $2) ON CONFLICT (publicador_id) DO UPDATE
            SET email_designacoes = EXCLUDED.email_designacoes, atualizado_em = NOW()`, [userId, preference]);
        const { rows } = await client.query(`SELECT p.email, COALESCE(pref.email_designacoes, TRUE) AS enabled
            FROM publicadores p LEFT JOIN alertas_preferencias pref ON pref.publicador_id = p.id
            WHERE p.id = $1`, [userId]);
        if (!rows.length) return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
        return NextResponse.json({ emailRemindersEnabled: rows[0].enabled, email: rows[0].email || '',
            automaticEmailActive: settings.emailEnabled }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Falha nas preferências de alerta:', error.message);
        return NextResponse.json({ message: 'Não foi possível salvar ou carregar suas preferências.' }, { status: 500 });
    } finally { client.release(); }
}

export async function GET(request) { return handle(request, false); }
export async function POST(request) { return handle(request, true); }
