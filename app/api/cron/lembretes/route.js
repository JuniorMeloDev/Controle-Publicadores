import { Pool } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAlertSettings, getActiveAssignments, deliverReminders } from '@/app/lib/alert-service';
import { todayInBrazil, buildEmailReminders, reminderMessage } from '@/app/lib/alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function GET(request) {
    // Fail closed: the scheduler's identity is a secret, never a caller-provided flag.
    if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    }
    const client = await pool.connect();
    try {
        const settings = await getAlertSettings(client);
        if (!settings.emailEnabled) return NextResponse.json({ message: 'Lembretes por e-mail desativados.' });
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return NextResponse.json({ message: 'Envio de e-mail não configurado.' }, { status: 503 });
        }
        const today = todayInBrazil();
        const assignments = await getActiveAssignments(client, { today });
        const { rows: publishers } = await client.query(`SELECT p.id, p.nome_completo, p.nome_chamado, p.email
            FROM publicadores p LEFT JOIN grupos g ON g.id = p.grupo_id
            WHERE NULLIF(trim(p.email), '') IS NOT NULL AND (g.id IS NULL OR g.ativo = TRUE)`);
        const { rows: retries } = await client.query(`SELECT publicador_id, data_designacao, antecedencia
            FROM alertas_email_envios WHERE data_designacao >= $1 AND
            (status = 'falhou' OR (status = 'processando' AND atualizado_em < NOW() - INTERVAL '15 minutes'))
            ORDER BY antecedencia`, [today]);
        const reminders = buildEmailReminders({ assignments, publishers, settings, today, retries });
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
        const totals = await deliverReminders(client, reminders, reminder => transporter.sendMail({
            from: `"Gestão Congregacional" <${process.env.EMAIL_USER}>`, to: reminder.email, ...reminderMessage(reminder),
        }));
        return NextResponse.json({ message: 'Lembretes processados.', ...totals }, { status: totals.failed ? 503 : 200 });
    } catch (error) {
        console.error('Falha ao processar lembretes:', error.message);
        return NextResponse.json({ message: 'Não foi possível processar os lembretes.' }, { status: 500 });
    } finally { client.release(); }
}
